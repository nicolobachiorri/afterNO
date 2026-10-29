"""
Step 1 - Divergence test.

For each site in sites.csv:
  1. open it in a fresh browser profile (no cookies, Italian locale);
  2. record cookies and third-party requests BEFORE any choice ("pre");
  3. look for a "reject" button in the page and in its iframes, and click it;
  4. record cookies and third-party requests AFTER the rejection ("post"),
     including a reload of the page, to see what persists.

Cookies are classified with the Open Cookie Database (functional, preferences,
analytics, marketing). Output: results.csv (one row per site) and raw/ (details).

Usage:
    python divergence_test.py                 # visible browser
    python divergence_test.py --headless      # no window
    python divergence_test.py --sites my.csv --wait 10
    python divergence_test.py --runs 3        # repeat every site 3 times

Version 4: "reject and subscribe" buttons are not treated as a rejection, buttons
that are not marked as buttons are found by their text, a click that fails is
retried, local overrides.csv completes the cookie database, and new metrics
count tracking cookies present without consent regardless of when they appeared.
"""

import argparse
import csv
import io
import json
import re
import time
import urllib.request
from pathlib import Path

import tldextract
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

OCD_URLS = [
    "https://raw.githubusercontent.com/jkwakman/Open-Cookie-Database/master/open-cookie-database.csv",
    "https://raw.githubusercontent.com/jkwakman/Open-Cookie-Database/main/open-cookie-database.csv",
]
OCD_CACHE = Path("open-cookie-database.csv")

# Text of buttons that mean "reject". Matched at the START of the button label,
# case-insensitive. Deliberately conservative: closing the banner with an "X"
# is NOT a rejection, so it is not in the list.
REJECT_PATTERN = re.compile(
    r"^\s*(rifiuta|rifiuto|nega|non accett|continua senza accettare|"
    r"accetta solo (i )?(cookie )?(necessari|essenziali|tecnici)|"
    r"consenti solo (i )?(cookie )?(necessari|essenziali|tecnici)|"
    r"usa solo (i )?(cookie )?(necessari|essenziali|tecnici)|"
    r"solo (i )?(cookie )?(necessari|essenziali|tecnici)|"
    r"reject|decline|deny|only necessary|necessary only|use necessary)",
    re.IGNORECASE,
)

TRACKING_CATEGORIES = {"Analytics", "Marketing"}

# Every category the database uses, plus Unknown, so the CSV always has the same columns.
CATEGORIES = ["Functional", "Necessary", "Preferences", "Personalization",
              "Analytics", "Marketing", "Security", "Unknown"]

# A "reject" label that also mentions paying is a pay-or-accept wall, not a rejection:
# "Rifiuta e abbonati" leads to a subscription page.
PAYWALL_IN_LABEL = re.compile(r"abbona|subscri|paga|acquista|premium", re.IGNORECASE)

OVERRIDES = Path("overrides.csv")

# Used only when no reject button is found, to describe what the banner offered.
PAY_PATTERN = re.compile(r"abbona|subscri|paga|acquista|premium", re.IGNORECASE)
ACCEPT_PATTERN = re.compile(r"accett|accept|consent|agree|ok\b|va bene|ho capito|continua", re.IGNORECASE)


# ---------------------------------------------------------------- cookie database

def load_cookie_db():
    """Return (exact, prefixes): exact name -> category, list of (prefix, category)."""
    if not OCD_CACHE.exists():
        errors = []
        for url in OCD_URLS:
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    OCD_CACHE.write_bytes(r.read())
                break
            except Exception as e:
                # Keep the reason: swallowing it hides the real cause.
                errors.append(f"  {url}\n    -> {e!r}")
                continue
        else:
            raise SystemExit(
                "Could not download the Open Cookie Database.\n"
                + "\n".join(errors)
                + "\nDownload open-cookie-database.csv manually from the GitHub "
                "repository jkwakman/Open-Cookie-Database and put it next to this script."
            )

    text = OCD_CACHE.read_text(encoding="utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    # Column names in the CSV; looked up loosely so a renamed header does not break us.
    cols = reader.fieldnames or []
    name_col = next(c for c in cols if "name" in c.lower() or "key" in c.lower())
    cat_col = next(c for c in cols if c.lower().startswith("category"))
    wild_col = next(c for c in cols if "wildcard" in c.lower())

    exact, prefixes = {}, []
    for row in reader:
        name, cat = (row[name_col] or "").strip(), (row[cat_col] or "").strip()
        if not name:
            continue
        if (row[wild_col] or "0").strip() == "1":
            prefixes.append((name, cat))
        else:
            exact[name] = cat
    # Our own classifications (overrides.csv) win over the database: they fill its
    # gaps with cookies we identified ourselves, each with a source.
    n_over = 0
    if OVERRIDES.exists():
        with open(OVERRIDES, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                name, cat = row["name"].strip(), row["category"].strip()
                if not name or row["name"].startswith("#"):
                    continue
                if row.get("match", "exact").strip() == "prefix":
                    prefixes.append((name, cat))
                else:
                    exact[name] = cat
                n_over += 1
    print(f"Overrides: {n_over} entries from {OVERRIDES}")
    # Longest prefixes first, so "_gac_gb_" wins over "_gac_".
    prefixes.sort(key=lambda p: len(p[0]), reverse=True)
    return exact, prefixes


def classify(name, exact, prefixes):
    if name in exact:
        return exact[name]
    for prefix, cat in prefixes:
        if name.startswith(prefix):
            return cat
    return "Unknown"


# ---------------------------------------------------------------- helpers

def site_domain(url):
    return tldextract.extract(url).registered_domain


def summarise_cookies(cookies, exact, prefixes):
    counts = {c: 0 for c in CATEGORIES}
    detail = []
    for c in cookies:
        cat = classify(c["name"], exact, prefixes)
        counts[cat] = counts.get(cat, 0) + 1
        detail.append({"name": c["name"], "domain": c["domain"], "category": cat})
    return counts, detail


def click_robustly(el):
    """Normal click, then a JavaScript click. Returns the method used.

    No forced click: when something covers the button, a forced click raises no
    error but lands on the covering element, so we would believe we rejected.
    The JavaScript click is delivered to the button itself.
    """
    for method in ("normal", "js"):
        try:
            if method == "normal":
                el.click(timeout=3000)
            else:
                el.evaluate("e => e.click()")
            return method
        except Exception:
            continue
    return None


def find_and_click_reject(page):
    """Search the page and every iframe for a visible reject control and click it.

    Returns (clicked, description, paywall_seen). Controls are looked up first as
    buttons and links, then by their text alone, because some banners use plain
    <div> or <span> elements that are not marked as buttons.
    """
    paywall_seen = False
    for frame in page.frames:
        where = "main" if frame == page.main_frame else frame.url[:80]
        lookups = [("button", lambda f: f.get_by_role("button", name=REJECT_PATTERN)),
                   ("link", lambda f: f.get_by_role("link", name=REJECT_PATTERN)),
                   ("text", lambda f: f.get_by_text(REJECT_PATTERN))]
        for kind, lookup in lookups:
            try:
                candidates = lookup(frame)
                for i in range(min(candidates.count(), 20)):
                    el = candidates.nth(i)
                    if not el.is_visible():
                        continue
                    label = " ".join((el.inner_text() or "").split())[:60]
                    if len(label) > 50:      # a paragraph, not a control
                        continue
                    if PAYWALL_IN_LABEL.search(label):
                        paywall_seen = True  # "Rifiuta e abbonati": not a rejection
                        continue
                    method = click_robustly(el)
                    if method:
                        return True, f"{kind}: '{label}' in {where} ({method} click)", paywall_seen
            except Exception:
                continue
    return False, ("paywall label found" if paywall_seen else "no reject button found"), paywall_seen


def visible_button_labels(page, limit=15):
    """Texts of the visible buttons in the page and its iframes (deduplicated)."""
    labels = []
    for frame in page.frames:
        try:
            buttons = frame.get_by_role("button")
            for i in range(min(buttons.count(), 200)):
                el = buttons.nth(i)
                if not el.is_visible():
                    continue
                text = " ".join((el.inner_text() or "").split())[:50]
                if text and text not in labels:
                    labels.append(text)
                if len(labels) >= limit:
                    return labels
        except Exception:
            continue
    return labels


def banner_type(clicked, labels, paywall_seen=False):
    """Rough description of the banner, from the buttons it shows."""
    if clicked:
        return "reject_found"
    if paywall_seen:
        return "pay_or_accept"
    if any(PAY_PATTERN.search(l) for l in labels) and any(ACCEPT_PATTERN.search(l) for l in labels):
        return "pay_or_accept"
    if any(ACCEPT_PATTERN.search(l) for l in labels):
        return "accept_only"
    return "no_banner_detected"


def has_tcf(page):
    try:
        return bool(page.evaluate("typeof window.__tcfapi === 'function'"))
    except Exception:
        return False


# ---------------------------------------------------------------- one site

def test_site(browser, url, wait_s, exact, prefixes, raw_dir, tag, banner_timeout):
    context = browser.new_context(
        locale="it-IT",
        timezone_id="Europe/Rome",
        viewport={"width": 1366, "height": 900},
    )
    # Playwright sets navigator.webdriver = true, which many sites read to spot
    # robots. A real user's browser reports undefined.
    context.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    page = context.new_page()
    home = site_domain(url)
    phase = {"name": "pre"}
    third_party = {"pre": set(), "post": set()}

    def on_request(req):
        d = site_domain(req.url)
        if d and d != home:
            third_party[phase["name"]].add(d)

    page.on("request", on_request)
    row = {"site": url}

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
    except PWTimeout:
        row["error"] = "timeout on load"
        context.close()
        return row, {}

    page.wait_for_timeout(wait_s * 1000)

    # ---- PRE: before any choice
    pre_counts, pre_detail = summarise_cookies(context.cookies(), exact, prefixes)
    tcf_pre = has_tcf(page)
    shot = tag
    try:
        page.screenshot(path=str(raw_dir / f"{shot}_1_pre.png"))
    except Exception:
        pass

    # ---- REJECT
    # Banners can appear seconds after the page: keep looking until a deadline.
    t_banner = time.time()
    while True:
        labels = visible_button_labels(page)
        clicked, how, paywall_seen = find_and_click_reject(page)
        # A pay-or-accept wall is a banner too: no point waiting further.
        if clicked or paywall_seen or time.time() - t_banner > banner_timeout:
            break
        page.wait_for_timeout(1000)
    row["banner_wait_s"] = round(time.time() - t_banner, 1)
    row["reject_clicked"] = clicked
    row["reject_how"] = how
    row["banner_type"] = banner_type(clicked, labels, paywall_seen)
    row["visible_buttons"] = " | ".join(labels)

    # ---- POST: after the choice, then after a reload
    phase["name"] = "post"
    page.wait_for_timeout(wait_s * 1000)
    if clicked:
        try:
            page.reload(wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(wait_s * 1000)
        except PWTimeout:
            pass
    post_counts, post_detail = summarise_cookies(context.cookies(), exact, prefixes)
    # The CMP may load late: count TCF as present if seen in either phase.
    row["tcf"] = tcf_pre or has_tcf(page)
    try:
        page.screenshot(path=str(raw_dir / f"{shot}_2_post.png"))
    except Exception:
        pass

    pre_names = {c["name"] for c in pre_detail}
    new_tracking_after = [
        c for c in post_detail
        if c["name"] not in pre_names and c["category"] in TRACKING_CATEGORIES
    ]

    for cat, n in pre_counts.items():
        row[f"pre_{cat.lower()}"] = n
    for cat, n in post_counts.items():
        row[f"post_{cat.lower()}"] = n
    row["new_tracking_after_reject"] = len(new_tracking_after)
    # Robust to timing: tracking cookies present at each moment, however they got
    # there. No consent was ever given, so every one of them is "without consent".
    row["tracking_pre"] = sum(pre_counts[c] for c in TRACKING_CATEGORIES)
    row["tracking_end"] = sum(post_counts[c] for c in TRACKING_CATEGORIES)
    row["third_party_pre"] = len(third_party["pre"])
    row["third_party_post"] = len(third_party["post"])

    raw = {
        "site": url,
        "reject": how,
        "banner_type": row["banner_type"],
        "visible_buttons": labels,
        "cookies_pre": pre_detail,
        "cookies_post": post_detail,
        "new_tracking_after_reject": new_tracking_after,
        "third_party_pre": sorted(third_party["pre"]),
        "third_party_post": sorted(third_party["post"]),
    }
    context.close()
    return row, raw


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sites", default="sites.csv")
    ap.add_argument("--out", default="results.csv")
    ap.add_argument("--wait", type=int, default=8, help="seconds to wait in each phase")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--runs", type=int, default=1, help="repeat the whole list N times")
    ap.add_argument("--banner-timeout", type=int, default=15,
                    help="extra seconds to keep looking for the reject button")
    ap.add_argument("--bundled-chromium", action="store_true",
                    help="use Playwright's Chromium instead of your installed Chrome")
    args = ap.parse_args()

    exact, prefixes = load_cookie_db()
    print(f"Cookie database: {len(exact)} exact names, {len(prefixes)} wildcard prefixes")

    with open(args.sites, encoding="utf-8") as f:
        sites = [r["url"].strip() for r in csv.DictReader(f) if r.get("url", "").strip()]

    raw_dir = Path("raw")
    raw_dir.mkdir(exist_ok=True)
    rows = []

    with sync_playwright() as p:
        launch = dict(headless=args.headless,
                      args=["--disable-blink-features=AutomationControlled"])
        browser = None
        if not args.bundled_chromium:
            try:
                # Your installed Google Chrome looks like a normal browser to sites.
                browser = p.chromium.launch(channel="chrome", **launch)
                print("Browser: installed Google Chrome")
            except Exception as e:
                print(f"Google Chrome not usable ({e.__class__.__name__}), falling back")
        if browser is None:
            browser = p.chromium.launch(**launch)
            print("Browser: Playwright's Chromium")
        jobs = [(run, i, url) for run in range(1, args.runs + 1)
                for i, url in enumerate(sites, 1)]
        for n, (run, i, url) in enumerate(jobs, 1):
            print(f"[{n}/{len(jobs)}] run {run} - {url}")
            tag = f"r{run}_{i:02d}_{site_domain(url) or 'site'}"
            t0 = time.time()
            try:
                row, raw = test_site(browser, url, args.wait, exact, prefixes, raw_dir, tag, args.banner_timeout)
            except Exception as e:
                row, raw = {"site": url, "error": repr(e)[:200]}, {}
            row["run"] = run
            row["seconds"] = round(time.time() - t0, 1)
            rows.append(row)
            if raw:
                (raw_dir / f"{tag}.json").write_text(json.dumps(raw, indent=2), encoding="utf-8")
            print("   ", {k: v for k, v in row.items() if k != "site"})
        browser.close()

    fields = sorted({k for r in rows for k in r}, key=lambda k: (k not in ("site", "run"), k))
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"\nDone. {len(rows)} sites -> {args.out}, details in {raw_dir}/")


if __name__ == "__main__":
    main()
