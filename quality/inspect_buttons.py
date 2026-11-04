"""
Show how the robot sees the buttons of a page (diagnosis, not part of the
measurement): for every visible button, its text, its accessible name (what
get_by_role matches), whether REJECT_PATTERN matches each, and its HTML.

Usage (from the quality folder):
    python3 inspect_buttons.py https://www.idonate.ie [--grep deny]
"""
import argparse
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "divergence_work_space"))
import divergence_test  # noqa: E402
import robot_labels  # noqa: E402

robot_labels.install(divergence_test)
P = robot_labels.REJECT_PATTERN

ap = argparse.ArgumentParser()
ap.add_argument("url")
ap.add_argument("--grep", default="")
args = ap.parse_args()
with sync_playwright() as p:
    b = p.chromium.launch(headless=False)
    page = b.new_page(locale="en-IE")
    page.set_default_timeout(5000)
    page.goto(args.url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(8000)
    for frame in page.frames:
        buttons = frame.get_by_role("button")
        for i in range(min(buttons.count(), 200)):
            el = buttons.nth(i)
            try:
                if not el.is_visible():
                    continue
                text = " ".join((el.inner_text() or "").split())
                if args.grep and args.grep.lower() not in text.lower():
                    continue
                name = el.evaluate("e => e.getAttribute('aria-label') || e.getAttribute('title') || ''")
                html = el.evaluate("e => e.outerHTML")[:400]
                print(f"text={text!r} aria/title={name!r} text_matches={bool(P.search(text))} "
                      f"aria_matches={bool(P.search(name))}\n   {html}\n")
            except Exception as e:
                print("error", repr(e)[:120])
    b.close()
