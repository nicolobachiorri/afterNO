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
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "divergence_work_space"))
# The banner logic of step 1, with the reject words of eight EU languages
# (robot_labels.py, protocol modification 21) in place of its Italian and English ones.
import divergence_test  # noqa: E402
import robot_labels  # noqa: E402
robot_labels.install(divergence_test)
from divergence_test import (  # noqa: E402
    banner_type, find_and_click_reject, site_domain, visible_button_labels,
)

EXTENSION_BUILD = HERE.parent / "extension" / ".output" / "chrome-mv3-test"
WAIT_AFTER_CLICK_S, WAIT_AFTER_RELOAD_S, FIRST_WAIT_S = 5, 10, 8
BANNER_TIMEOUT_S = 15

# Read the TCF signal in the page itself, without the extension: the raw data must
# not depend on the code being measured.
# 'addEventListener', not 'getTCData': getTCData is deprecated in TCF 2.2 and many
# consent platforms answer it with "not available". The first answer is the current
# state; the listener is then removed.
TCF_JS = """
() => new Promise((resolve) => {
  if (typeof window.__tcfapi !== 'function') return resolve(null);
  const timer = setTimeout(() => resolve({ timeout: true }), 5000);
  try {
    window.__tcfapi('addEventListener', 2, (d, ok) => {
      if (!ok || !d) return;
      clearTimeout(timer);
      try { window.__tcfapi('removeEventListener', 2, () => {}, d.listenerId); } catch (e) {}
      const count = (o) => Object.values(o || {}).filter(Boolean).length;
      resolve({
        cmpId: d.cmpId, eventStatus: d.eventStatus, gdprApplies: d.gdprApplies,
        purposesListed: Object.keys((d.purpose && d.purpose.consents) || {}).length,
        purposeConsents: count(d.purpose && d.purpose.consents),
        purposeLegitimateInterests: count(d.purpose && d.purpose.legitimateInterests),
        vendorConsents: count(d.vendor && d.vendor.consents),
      });
    });
  } catch (e) { clearTimeout(timer); resolve({ error: String(e) }); }
})
"""


def sample_file(visit):
    """Visits A and B use sample A/B (sites.csv); visits C1, C2... use sample C, and so on."""
    letter = (visit or "")[:1]
    return HERE / (f"sites_{letter}.csv" if letter in ("C", "D", "E", "F") else "sites.csv")


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
        # The popup's security policy forbids evaluating code passed as text, so wait
        # for an attribute and read it, without running anything in the page.
        pop.wait_for_selector("body[data-ready='1']", state="attached", timeout=20000)
        raw = pop.get_attribute("body", "data-verdict")
        pop.screenshot(path=str(shot_path), full_page=True)
        return json.loads(raw) if raw else {"error": "no verdict reported"}
    except Exception as e:
        return {"error": f"popup: {e!r}"[:300]}
    finally:
        pop.close()


SITE_LIMIT_S = 240  # a site that takes longer is stopped (visit F1, protocol modification 29)


def measure_site(p, row, out_dir, headless):
    url = row["url"]
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    def stage(name):
        # Where the robot is, so that a site that hangs shows where (stage.txt).
        with open(out_dir / "stage.txt", "a", encoding="utf-8") as f:
            f.write(f"{time.time() - t0:7.1f}s {name}\n")
    stage("start")
    profile = tempfile.mkdtemp(prefix="cookie-quality-")
    result = {"order": row["order"], "url": url, "source": row["source"]}
    requests = []  # (seconds since start, host, resource type, url)
    cached = []  # (seconds since start, url) of responses served by the browser's cache
    t_start = time.time()
    context = None
    try:
        # Extensions need Playwright's own Chromium: branded Chrome no longer loads
        # unpacked extensions from the command line.
        stage("launch browser")
        context = p.chromium.launch_persistent_context(
            profile, channel="chromium", headless=headless,
            args=[f"--disable-extensions-except={EXTENSION_BUILD}",
                  f"--load-extension={EXTENSION_BUILD}",
                  "--disable-blink-features=AutomationControlled",
                  "--lang=it-IT"],  # the popup in Italian, as the judge reads it
            # The site sees the language and time zone of its country (sample E);
            # Italian otherwise.
            locale=row.get("locale") or "it-IT", timezone_id=row.get("timezone") or "Europe/Rome",
            viewport={"width": 1366, "height": 900},
        )
        context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        # Every page action gets at most 5 s (Playwright's default is 30 s): on a page
        # whose buttons keep changing, reading their text could wait 30 s per button,
        # and the banner search hung for minutes (rbb24.de, visit F1). Loading and the
        # waits below keep their own explicit times.
        context.set_default_timeout(5000)
        sw = context.service_workers[0] if context.service_workers else \
            context.wait_for_event("serviceworker", timeout=15000)
        ext_id = sw.url.split("/")[2]
        # Let the extension finish starting before the site opens, as for a user whose
        # browser has been open for a while: a round trip to it, then a short pause.
        sw.evaluate("async () => chrome.storage.session.get(null)")
        time.sleep(1.5)

        def on_request(r):
            # Web requests only: the extension's own (chrome-extension://) are not
            # sites the page contacted. Host name without the port.
            u = urlparse(r.url)
            if u.scheme in ("http", "https") and u.hostname:
                requests.append((round(time.time() - t_start, 2), u.hostname, r.resource_type, r.url))
        context.on("request", on_request)
        page = context.pages[0] if context.pages else context.new_page()

        # Requests the browser answers from its own cache never reach the third party
        # and carry no cookies: they are not contacts (protocol, modification 14).
        # Chrome reports them through the DevTools protocol: memory cache as
        # requestServedFromCache, disk and prefetch cache on the response. The session
        # covers the page and the iframes in its process; a cached request inside a
        # cross-site iframe is still counted as a contact (a stated limit).
        cdp = context.new_cdp_session(page)
        cdp.send("Network.enable")
        urls = {}
        cdp.on("Network.requestWillBeSent", lambda e: urls.__setitem__(e["requestId"], e["request"]["url"]))
        def from_memory(e):
            if e["requestId"] in urls:
                cached.append((round(time.time() - t_start, 2), urls[e["requestId"]]))
        def from_other_cache(e):
            resp = e["response"]
            if resp.get("fromDiskCache") or resp.get("fromPrefetchCache"):
                cached.append((round(time.time() - t_start, 2), resp["url"]))
        cdp.on("Network.requestServedFromCache", from_memory)
        cdp.on("Network.responseReceived", from_other_cache)

        try:
            stage("load page")
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
            stage("search banner")
            clicked, how, paywall_seen = find_and_click_reject(page)
            if clicked or paywall_seen or time.time() - t_banner > BANNER_TIMEOUT_S:
                break
            page.wait_for_timeout(1000)
        t_click = round(time.time() - t_start, 2)
        result.update(reject_clicked=clicked, reject_how=how,
                      banner_type=banner_type(clicked, labels, paywall_seen),
                      visible_buttons=" | ".join(labels))

        page.wait_for_timeout(WAIT_AFTER_CLICK_S * 1000)
        t_reload = None
        if clicked:
            t_reload = round(time.time() - t_start, 2)
            try:
                stage("reload")
                page.reload(wait_until="domcontentloaded", timeout=45000)
            except PWTimeout:
                pass
            page.wait_for_timeout(WAIT_AFTER_RELOAD_S * 1000)
        try:
            stage("screenshot")
            page.screenshot(path=str(out_dir / "page.png"))
        except Exception:
            pass

        stage("raw data")
        # Raw data, independent of the extension.
        try:
            tcf = page.evaluate(TCF_JS)
        except Exception as e:
            tcf = {"error": repr(e)[:200]}
        home = site_domain(page.url)
        # Each cached response cancels one request to the same address made shortly
        # before it; what is left went to the network.
        pending = list(cached)
        network, from_cache = [], []
        for t, h, _, u in requests:
            hit = next((c for c in pending if c[1] == u and -1 <= c[0] - t <= 5), None)
            if hit:
                pending.remove(hit)
                from_cache.append((t, h))
            else:
                network.append((t, h))
        third = [(t, h) for t, h in network if h and site_domain("https://" + h) != home]
        third_cached = sorted({h for t, h in from_cache if h and site_domain("https://" + h) != home and t >= t_click})
        after = sorted({h for t, h in third if t >= t_click})
        # When each third-party host was contacted (first and last time, seconds from
        # the start), so the judge can tell "after the click" from "after the reload".
        timeline = {}
        for t, h in third:
            first, last = timeline.get(h, (t, t))
            timeline[h] = (min(first, t), max(last, t))
        raw = {
            "url": url, "final_url": page.url, "click_at_s": t_click, "reload_at_s": t_reload,
            "reject": how, "visible_buttons": labels, "tcf": tcf,
            "third_party_hosts_after_click": after,
            "third_party_hosts_after_reload": sorted({h for t, h in third if t_reload is not None and t >= t_reload}),
            "third_party_timeline": {h: {"first_s": a, "last_s": b} for h, (a, b) in sorted(timeline.items())},
            # Not contacts: answered by the browser's cache after the click (for the judge).
            "third_party_hosts_served_from_cache_after_click": third_cached,
            "cookies": all_cookies(context, page),
        }
        (out_dir / "raw.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")

        # The extension's verdict, from its popup, on this page's tab.
        tabs = sw.evaluate("async () => (await chrome.tabs.query({})).map(t => ({id: t.id, url: t.url}))")
        tab = next((t for t in tabs if t["url"] == page.url), None) or \
            next((t for t in tabs if t["url"] and t["url"].startswith("http")), None)
        stage("popup")
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
    ap.add_argument("--visit", choices=["A", "B", "C1", "C2", "D1", "D2", "E1", "E2", "F1", "F2"])
    ap.add_argument("--pilot", metavar="URL",
                    help="measure one site OUTSIDE the sample, to check the robot works "
                         "without looking at results of the sample (output in runs/pilot/)")
    ap.add_argument("--sites", type=Path, help="sample file (default: by visit, see sample_file)")
    ap.add_argument("--only", help="comma-separated order numbers")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--child", help=argparse.SUPPRESS)  # internal: one site, in its own process
    args = ap.parse_args()

    if args.child:
        row, folder = json.loads(args.child)
        with sync_playwright() as p:
            r = measure_site(p, row, Path(folder), args.headless)
        Path(folder, "result.json").write_text(json.dumps(r, ensure_ascii=False), encoding="utf-8")
        return

    if not (EXTENSION_BUILD / "manifest.json").exists():
        sys.exit(f"Extension build not found in {EXTENSION_BUILD}.\n"
                 "Build it first, from the extension folder:  npm run build:test")

    if bool(args.visit) == bool(args.pilot):
        sys.exit("Give either --visit A|B or --pilot URL.")
    if args.pilot:
        sample = [{"order": "0", "url": args.pilot, "source": "pilot", "role": "pilot"}]
        args.visit, args.only = "pilot", None
    else:
        sample = load_sample(args.sites or sample_file(args.visit), args.only)
    run_dir = HERE / "runs" / args.visit
    results = []
    # Each site runs in its own process, stopped after SITE_LIMIT_S: a page that hangs
    # the browser cannot stop the whole visit (visit F1, protocol modification 29).
    for n, row in enumerate(sample, 1):
        print(f"[{n}/{len(sample)}] {row['order']} {row['url']}")
        folder = run_dir / f"{int(row['order']):02d}_{site_domain(row['url']) or 'site'}"
        folder.mkdir(parents=True, exist_ok=True)
        for old in ("result.json", "stage.txt"):
            (folder / old).unlink(missing_ok=True)
        cmd = [sys.executable, __file__, "--child", json.dumps([row, str(folder)])]
        if args.headless:
            cmd.append("--headless")
        proc = subprocess.Popen(cmd, start_new_session=True)
        try:
            proc.wait(timeout=SITE_LIMIT_S)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)  # the child and its browser
            proc.wait()
        done = folder / "result.json"
        if done.exists():
            r = json.loads(done.read_text(encoding="utf-8"))
        else:
            last = (folder / "stage.txt").read_text(encoding="utf-8").strip().splitlines()[-1:] \
                if (folder / "stage.txt").exists() else ["?"]
            r = {"order": row["order"], "url": row["url"], "source": row["source"],
                 "error": f"stopped after {SITE_LIMIT_S} s, at: {last[0].strip()}",
                 "seconds": SITE_LIMIT_S}
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
