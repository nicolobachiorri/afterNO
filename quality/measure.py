"""
Quality measurement: one visit (A or B) to every site of the sample, with the real
extension installed. See PROTOCOL.md for the method and the rules.

For each site, in a new browser profile:
  1. open the home page with the extension loaded;
  2. find and click the reject button (same rules as step 1, imported from
     divergence_work_space/divergence_test.py);
  3. wait 5 s, reload, wait 10 s;
  4. save the extension's verdict (read from its popup), screenshots, and the raw
     data collected by this script independently of the extension: every cookie,
     the domains contacted after the click, the TCF signal.

Before running, build the extension in measurement mode (from the extension folder):
    npm run build:test

Usage (from the quality folder, with the step 1 virtual environment active):
    python3 measure.py --pilot https://www.ilmeteo.it   # try the robot outside the sample
    python3 measure.py --visit A
    python3 measure.py --visit A --only 3,7      # some sites only (order numbers)
    python3 measure.py --visit B --headless

Output: runs/<visit>/results.csv and one folder per site with verdict.json,
raw.json, popup.png, page.png.
"""

import argparse
import csv
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "divergence_work_space"))
# The banner logic of step 1, unchanged: the same rules decide what a rejection is.
from divergence_test import (  # noqa: E402
    banner_type, find_and_click_reject, site_domain, visible_button_labels,
)

EXTENSION_BUILD = HERE.parent / "extension" / ".output" / "chrome-mv3-test"
WAIT_AFTER_CLICK_S, WAIT_AFTER_RELOAD_S, FIRST_WAIT_S = 5, 10, 8
BANNER_TIMEOUT_S = 15

# Read the TCF signal in the page itself, without the extension: the raw data must
# not depend on the code being measured.
TCF_JS = """
() => new Promise((resolve) => {
  if (typeof window.__tcfapi !== 'function') return resolve(null);
  const timer = setTimeout(() => resolve({ timeout: true }), 3000);
  try {
    window.__tcfapi('getTCData', 2, (d, ok) => {
      clearTimeout(timer);
      if (!ok || !d) return resolve({ ok: false });
      const count = (o) => Object.values(o || {}).filter(Boolean).length;
      resolve({
        cmpId: d.cmpId, eventStatus: d.eventStatus, gdprApplies: d.gdprApplies,
        purposeConsents: count(d.purpose && d.purpose.consents),
        purposeLegitimateInterests: count(d.purpose && d.purpose.legitimateInterests),
        vendorConsents: count(d.vendor && d.vendor.consents),
      });
    });
  } catch (e) { clearTimeout(timer); resolve({ error: String(e) }); }
})
"""


def load_sample(path, only):
    with open(path, encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["role"].startswith("sample")]
    if only:
        wanted = {int(x) for x in only.split(",")}
        rows = [r for r in rows if int(r["order"]) in wanted]
    return rows


def all_cookies(context, page):
    """Every cookie in the profile, partitioned ones included (CDP gives the
    partition key; Playwright's own cookie list does not always)."""
    try:
        cdp = context.new_cdp_session(page)
        cookies = cdp.send("Storage.getCookies")["cookies"]
        cdp.detach()
        return [{
            "name": c["name"], "domain": c["domain"], "path": c.get("path"),
            "expires": c.get("expires"), "session": c.get("session"),
            "sameSite": c.get("sameSite"), "secure": c.get("secure"),
            "partitionKey": c.get("partitionKey"),
        } for c in cookies]
    except Exception as e:
        return [{"error": repr(e)[:200]}]


def read_verdict(context, ext_id, tab_id, shot_path):
    """Open the popup on the given tab and return the verdict it reports."""
    pop = context.new_page()
    pop.set_viewport_size({"width": 420, "height": 900})
    try:
        pop.goto(f"chrome-extension://{ext_id}/popup.html?tab={tab_id}")
        pop.wait_for_function("document.body.dataset.ready === '1'", timeout=20000)
        raw = pop.evaluate("document.body.dataset.verdict || null")
        pop.screenshot(path=str(shot_path), full_page=True)
        return json.loads(raw) if raw else {"error": "no verdict reported"}
    except Exception as e:
        return {"error": f"popup: {e!r}"[:300]}
    finally:
        pop.close()


def measure_site(p, row, out_dir, headless):
    url = row["url"]
    out_dir.mkdir(parents=True, exist_ok=True)
    profile = tempfile.mkdtemp(prefix="cookie-quality-")
    result = {"order": row["order"], "url": url, "source": row["source"]}
    requests = []  # (seconds since start, host, resource type)
    t_start = time.time()
    context = None
    try:
        # Extensions need Playwright's own Chromium: branded Chrome no longer loads
        # unpacked extensions from the command line.
        context = p.chromium.launch_persistent_context(
            profile, channel="chromium", headless=headless,
            args=[f"--disable-extensions-except={EXTENSION_BUILD}",
                  f"--load-extension={EXTENSION_BUILD}",
                  "--disable-blink-features=AutomationControlled"],
            locale="it-IT", timezone_id="Europe/Rome",
            viewport={"width": 1366, "height": 900},
        )
        context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        sw = context.service_workers[0] if context.service_workers else \
            context.wait_for_event("serviceworker", timeout=15000)
        ext_id = sw.url.split("/")[2]

        context.on("request", lambda r: requests.append(
            (round(time.time() - t_start, 2), r.url.split("/")[2] if "://" in r.url else "", r.resource_type)))
        page = context.pages[0] if context.pages else context.new_page()

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
        except PWTimeout:
            result["error"] = "timeout on load"
            return result
        result["final_url"] = page.url
        result["redirected_to_other_site"] = site_domain(page.url) != site_domain(url)
        page.wait_for_timeout(FIRST_WAIT_S * 1000)

        # Reject, with the rules of step 1.
        t_banner = time.time()
        while True:
            labels = visible_button_labels(page)
            clicked, how, paywall_seen = find_and_click_reject(page)
            if clicked or paywall_seen or time.time() - t_banner > BANNER_TIMEOUT_S:
                break
            page.wait_for_timeout(1000)
        t_click = round(time.time() - t_start, 2)
        result.update(reject_clicked=clicked, reject_how=how,
                      banner_type=banner_type(clicked, labels, paywall_seen),
                      visible_buttons=" | ".join(labels))

        page.wait_for_timeout(WAIT_AFTER_CLICK_S * 1000)
        if clicked:
            try:
                page.reload(wait_until="domcontentloaded", timeout=45000)
            except PWTimeout:
                pass
            page.wait_for_timeout(WAIT_AFTER_RELOAD_S * 1000)
        try:
            page.screenshot(path=str(out_dir / "page.png"))
        except Exception:
            pass

        # Raw data, independent of the extension.
        try:
            tcf = page.evaluate(TCF_JS)
        except Exception as e:
            tcf = {"error": repr(e)[:200]}
        home = site_domain(page.url)
        after = sorted({h for t, h, _ in requests if t >= t_click and h and site_domain("https://" + h) != home})
        raw = {
            "url": url, "final_url": page.url, "click_at_s": t_click, "reject": how,
            "visible_buttons": labels, "tcf": tcf,
            "third_party_hosts_after_click": after,
            "cookies": all_cookies(context, page),
        }
        (out_dir / "raw.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")

        # The extension's verdict, from its popup, on this page's tab.
        tabs = sw.evaluate("async () => (await chrome.tabs.query({})).map(t => ({id: t.id, url: t.url}))")
        tab = next((t for t in tabs if t["url"] == page.url), None) or \
            next((t for t in tabs if t["url"] and t["url"].startswith("http")), None)
        verdict = read_verdict(context, ext_id, tab["id"], out_dir / "popup.png") if tab \
            else {"error": "tab not found"}
        (out_dir / "verdict.json").write_text(json.dumps(verdict, indent=2, ensure_ascii=False), encoding="utf-8")

        choice = verdict.get("choice") or {}
        conclusion = verdict.get("conclusion") or {}
        result.update(
            tcf_present=bool(tcf) and not (isinstance(tcf, dict) and tcf.get("error")),
            choice_recorded=choice.get("choice", ""), choice_source=choice.get("source", ""),
            conclusion=conclusion.get("key", ""), tone=conclusion.get("tone", ""),
            items=" ; ".join(f"{i['mark']}:{i['key']}" for i in verdict.get("items", [])),
            third_party_hosts_after_click=len(after),
            verdict_error=verdict.get("error", ""),
        )
        return result
    except Exception as e:
        result["error"] = repr(e)[:300]
        return result
    finally:
        result["seconds"] = round(time.time() - t_start, 1)
        if context:
            context.close()
        shutil.rmtree(profile, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--visit", choices=["A", "B"])
    ap.add_argument("--pilot", metavar="URL",
                    help="measure one site OUTSIDE the sample, to check the robot works "
                         "without looking at results of the sample (output in runs/pilot/)")
    ap.add_argument("--sites", type=Path, default=HERE / "sites.csv")
    ap.add_argument("--only", help="comma-separated order numbers")
    ap.add_argument("--headless", action="store_true")
    args = ap.parse_args()

    if not (EXTENSION_BUILD / "manifest.json").exists():
        sys.exit(f"Extension build not found in {EXTENSION_BUILD}.\n"
                 "Build it first, from the extension folder:  npm run build:test")

    if bool(args.visit) == bool(args.pilot):
        sys.exit("Give either --visit A|B or --pilot URL.")
    if args.pilot:
        sample = [{"order": "0", "url": args.pilot, "source": "pilot", "role": "pilot"}]
        args.visit, args.only = "pilot", None
    else:
        sample = load_sample(args.sites, args.only)
    run_dir = HERE / "runs" / args.visit
    results = []
    with sync_playwright() as p:
        for n, row in enumerate(sample, 1):
            print(f"[{n}/{len(sample)}] {row['order']} {row['url']}")
            folder = run_dir / f"{int(row['order']):02d}_{site_domain(row['url']) or 'site'}"
            r = measure_site(p, row, folder, args.headless)
            r["visit"] = args.visit
            results.append(r)
            print("    ", {k: v for k, v in r.items() if k in
                           ("banner_type", "reject_how", "choice_recorded", "conclusion", "error", "verdict_error")})

    out = run_dir / "results.csv"
    fields = ["visit", "order", "url", "source", "final_url", "redirected_to_other_site",
              "banner_type", "reject_clicked", "reject_how", "visible_buttons", "tcf_present",
              "choice_recorded", "choice_source", "conclusion", "tone", "items",
              "third_party_hosts_after_click", "verdict_error", "error", "seconds"]
    # With --only, keep the rows of the other sites from a previous run.
    previous = []
    if args.only and out.exists():
        done = {r["order"] for r in results}
        with open(out, encoding="utf-8") as f:
            previous = [r for r in csv.DictReader(f) if r["order"] not in done]
    rows = sorted(previous + results, key=lambda r: int(r["order"]))
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"\nDone: {len(results)} sites -> {out}")


if __name__ == "__main__":
    main()
