"""
Diagnosis of two defects found in visit C1 (not part of the measurement).

1. A reject click the extension does not record (sites without TCF). Before clicking,
   the script describes the button the robot would click: tag, label, attributes,
   frame, shadow DOM, and the text of its containers (what inConsentBanner reads).
   It then watches which events reach the page during the click, and reads what
   the extension stored.
2. Requests the extension may not attribute to the tab (--watch): for every request
   to a matching host, whether it comes from a page frame or a service worker.

Usage (from the quality folder, after `npm run build:test` in extension/):
    python3 diagnose.py https://www.arera.it https://www.cloud.it
    python3 diagnose.py https://www.borsaitaliana.it --watch blendee
Output: printed, and runs/diagnosis/<site>.json
"""

import argparse
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "divergence_work_space"))
sys.path.insert(0, str(HERE))
from robot_labels import REJECT_PATTERN, PAYWALL_IN_LABEL  # noqa: E402

EXT = HERE.parent / "extension" / ".output" / "chrome-mv3-test"

# Runs in the page before anything else: logs the events of every click, at the
# very first moment (window, capture), so we see clicks even if the site stops them.
EVENT_LOG = """
window.__diag = [];
for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
  window.addEventListener(type, (e) => {
    const t = e.composedPath()[0];
    window.__diag.push({ type, trusted: e.isTrusted, tag: t && t.tagName,
      text: t && (t.textContent || '').trim().slice(0, 60), t: Math.round(performance.now()) });
  }, true);
}
"""

# Describes an element as the content script sees it.
DESCRIBE = """
(el) => {
  const attrs = {};
  for (const a of el.attributes) attrs[a.name] = a.value.slice(0, 120);
  const up = (n) => n.parentElement || (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);
  const containers = [];
  let n = el, depth = 0;
  while (n && depth < 15) {
    const text = (n.textContent || '').replace(/\\s+/g, ' ');
    containers.push({ tag: n.tagName, id: n.id || '', cls: (n.getAttribute && n.getAttribute('class') || '').slice(0, 80),
      textLength: text.length, mentionsConsent: /cookie|consens|consent|privacy|gdpr|partner|tracciament|tracking/i.test(text) });
    n = up(n); depth++;
  }
  return { tag: el.tagName, role: el.getAttribute('role'), text: (el.textContent || '').trim().slice(0, 80),
    ariaLabel: el.getAttribute('aria-label'), attrs, inShadow: el.getRootNode() instanceof ShadowRoot,
    containers };
}
"""


def find_reject(page):
    for frame in page.frames:
        for kind, loc in (("button", frame.get_by_role("button", name=REJECT_PATTERN)),
                          ("link", frame.get_by_role("link", name=REJECT_PATTERN)),
                          ("text", frame.get_by_text(REJECT_PATTERN))):
            try:
                for i in range(min(loc.count(), 20)):
                    el = loc.nth(i)
                    label = " ".join((el.inner_text() or "").split())
                    if el.is_visible() and len(label) <= 50 and not PAYWALL_IN_LABEL.search(label):
                        return frame, kind, el
            except Exception:
                continue
    return None, None, None


def diagnose(p, url, watch, out_dir):
    profile = tempfile.mkdtemp(prefix="cookie-diag-")
    report = {"url": url}
    ctx = p.chromium.launch_persistent_context(
        profile, channel="chromium", headless=False,
        args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}",
              "--disable-blink-features=AutomationControlled", "--lang=it-IT"],
        locale="it-IT", timezone_id="Europe/Rome", viewport={"width": 1366, "height": 900})
    try:
        ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        ctx.add_init_script(EVENT_LOG)
        sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=15000)
        sw.evaluate("async () => chrome.storage.session.get(null)")
        time.sleep(1.5)
        watched = []
        if watch:
            def on_request(r):
                host = urlparse(r.url).hostname or ""
                if watch in host:
                    try:
                        origin = f"frame {r.frame.url[:80]}"
                    except Exception:
                        origin = "not tied to a page frame"
                    sw_origin = getattr(r, "service_worker", None)
                    watched.append({"host": host, "type": r.resource_type,
                                    "origin": "service worker" if sw_origin else origin})
            ctx.on("request", on_request)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        cache_log = []
        if watch:
            # Whether each request to the watched host really went to the network or was
            # served by the browser's cache: a cached script reaches no server, and the
            # extension (webRequest) does not see it, while the robot does.
            cdp = ctx.new_cdp_session(page)
            cdp.send("Network.enable")
            urls = {}
            cdp.on("Network.requestWillBeSent", lambda e: urls.__setitem__(e["requestId"], e["request"]["url"]))
            def served_from_cache(e):
                u = urls.get(e["requestId"], "")
                if watch in u:
                    cache_log.append({"url": u[:90], "from": "memory cache", "t": round(time.time() - t0, 2)})
            def response(e):
                u, r = e["response"]["url"], e["response"]
                if watch in u:
                    src = ("disk cache" if r.get("fromDiskCache") else "prefetch cache" if r.get("fromPrefetchCache")
                           else "service worker" if r.get("fromServiceWorker") else "network")
                    cache_log.append({"url": u[:90], "from": src, "t": round(time.time() - t0, 2)})
            cdp.on("Network.requestServedFromCache", served_from_cache)
            cdp.on("Network.responseReceived", response)
        t0 = time.time()
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(8000)

        frame, kind, el = find_reject(page)
        if not el:
            report["reject"] = "not found"
        else:
            report["frame"] = "main" if frame == page.main_frame else frame.url[:100]
            report["found_as"] = kind
            report["button"] = el.evaluate(DESCRIBE)
            el.click(timeout=3000)
            page.wait_for_timeout(3000)
            report["events_in_frame"] = frame.evaluate("window.__diag || []")
            report["banner_still_visible"] = el.is_visible() if el.count() else False
        store = sw.evaluate("async () => chrome.storage.session.get(null)")
        report["extension_choice"] = {k: v for k, v in store.items() if k.startswith("choice:")}
        if watch:
            t_reload = round(time.time() - t0, 2)
            page.reload(wait_until="domcontentloaded")
            page.wait_for_timeout(8000)
            report["reload_at_s"] = t_reload
            report["main_frame_cache_log"] = cache_log
            report["watched_requests"] = watched
            now_ms = time.time() * 1000
            report["extension_tab_hosts_seconds_ago"] = {k: {h: round((now_ms - t) / 1000, 1) for h, t in v.get("lastSeen", {}).items() if watch in h}
                                            for k, v in sw.evaluate("async () => chrome.storage.session.get(null)").items()
                                            if k.startswith("tab:")}
    except Exception as e:
        report["error"] = repr(e)[:300]
    finally:
        ctx.close()
        shutil.rmtree(profile, ignore_errors=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{urlparse(url).hostname}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="+")
    ap.add_argument("--watch", help="part of a host name whose requests to trace (e.g. blendee)")
    args = ap.parse_args()
    if not (EXT / "manifest.json").exists():
        sys.exit("Build the extension first: npm run build:test (in extension/)")
    with sync_playwright() as p:
        for url in args.urls:
            print(f"\n=== {url}")
            print(json.dumps(diagnose(p, url, args.watch, HERE / "runs" / "diagnosis"), indent=2, ensure_ascii=False)[:4000])


if __name__ == "__main__":
    main()
