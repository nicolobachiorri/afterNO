"""
Screenshots of the popup in another language, for the store listings, without
changing the language of the computer or of your own Chrome.

Opens the robot's Chromium (Playwright) with the extension and the chosen language.
You click the banner yourself; then press Enter here and the script photographs the
popup (the whole height, light theme, at double resolution, closed and with each section open) into
store/screenshots/<lang>/raw/.

Usage (from the cookie_project folder, after `npm run build:test` in extension/):
    python3 store/shoot.py https://www.thefork.it https://www.ilmeteo.it
    python3 store/shoot.py --lang it-IT https://www.thefork.it
"""

import argparse
import shutil
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension" / ".output" / "chrome-mv3-test"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="+")
    ap.add_argument("--lang", default="en-US")
    args = ap.parse_args()
    out = ROOT / "store" / "screenshots" / args.lang.split("-")[0] / "raw"
    out.mkdir(parents=True, exist_ok=True)
    profile = tempfile.mkdtemp(prefix="afterno-shoot-")
    # On macOS Chromium ignores --lang and follows the system language. So the popup
    # is forced into the chosen language on a temporary copy of the build: that
    # language's texts are copied over every other language. The build is untouched.
    ext = Path(tempfile.mkdtemp(prefix="afterno-ext-")) / "ext"
    shutil.copytree(EXT, ext)
    wanted = ext / "_locales" / args.lang.split("-")[0] / "messages.json"
    for folder in (ext / "_locales").iterdir():
        if folder.is_dir() and folder != wanted.parent:
            shutil.copy(wanted, folder / "messages.json")
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            profile, channel="chromium", headless=False,
            args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}", f"--lang={args.lang}",
                  "--disable-blink-features=AutomationControlled"],
            locale=args.lang, color_scheme="light", viewport={"width": 1366, "height": 900},
            device_scale_factor=2)
        try:
            # Same disguise as the measurement robot: some sites block automated browsers.
            ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=15000)
            ext_id = sw.url.split("/")[2]
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            for url in args.urls:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                input(f"\n{url}\n  Click the reject button in the banner, wait a few seconds, then press Enter here... ")
                tabs = sw.evaluate("async () => (await chrome.tabs.query({})).map(t => ({id: t.id, url: t.url}))")
                tab = next(t for t in tabs if t["url"] and t["url"].startswith("http"))
                pop = ctx.new_page()
                pop.set_viewport_size({"width": 380, "height": 900})
                pop.goto(f"chrome-extension://{ext_id}/popup.html?tab={tab['id']}")
                pop.wait_for_selector("body[data-ready='1']", state="attached", timeout=20000)
                pop.wait_for_timeout(500)
                name = urlparse(url).hostname.removeprefix("www.")
                # Three captures: as it opens, with "Why?" open, with the cookies open.
                # Opened by clicking, as a user would (the popup forbids injected code).
                rows = pop.locator("details.toggle > summary")
                for label, index in (("closed", None), ("why", 0), ("cookies", 1)):
                    if index is not None:
                        if index == 1:
                            rows.nth(0).click()  # close "Why?" again
                        rows.nth(index).click()
                        pop.wait_for_timeout(300)
                    path = out / f"{name}_{label}.png"
                    pop.screenshot(path=str(path), full_page=True, scale="device")
                    print(f"  saved {path.relative_to(ROOT)}")
                pop.close()
        finally:
            ctx.close()
            shutil.rmtree(profile, ignore_errors=True)
            shutil.rmtree(ext.parent, ignore_errors=True)


if __name__ == "__main__":
    main()
