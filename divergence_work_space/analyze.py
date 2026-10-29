"""
Step 1 - Analysis of the divergence test.

Reads the results of divergence_test.py (one row per site and run) and prints:
  1. how the banners behaved (and whether that was stable across runs);
  2. the pre-registered decision rule, with two ways of combining the runs;
  3. the timing-robust measure: marketing and analytics cookies still present
     at the end, after a real rejection.

Only the standard library is used, so it runs in the same .venv as the test.

Usage:
    python analyze.py                          # results_v4.csv + sites.csv
    python analyze.py --results other.csv --threshold-sites 5 --threshold-cookies 2
"""

import argparse
import csv
import statistics
from collections import Counter, defaultdict


def as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def load(results_path, sites_path):
    with open(results_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    site_type = {}
    try:
        with open(sites_path, encoding="utf-8") as f:
            site_type = {r["url"].strip(): r.get("type", "") for r in csv.DictReader(f)}
    except FileNotFoundError:
        pass
    by_site = defaultdict(list)
    for r in rows:
        by_site[r["site"]].append(r)
    return rows, by_site, site_type


def short(url):
    return url.replace("https://", "").replace("www.", "").rstrip("/")


def section(title):
    print(f"\n{title}\n{'-' * len(title)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default="results_v4.csv")
    ap.add_argument("--sites", default="sites.csv")
    ap.add_argument("--threshold-cookies", type=int, default=2,
                    help="new tracking cookies after rejection for a site to count")
    ap.add_argument("--threshold-sites", type=int, default=5,
                    help="sites needed for the decision rule to be met")
    args = ap.parse_args()

    rows, by_site, site_type = load(args.results, args.sites)
    n_runs = max(as_int(r.get("run", 1)) for r in rows)
    errors = [r for r in rows if r.get("error")]
    print(f"{len(rows)} rows, {len(by_site)} sites, {n_runs} runs, {len(errors)} errors")

    # ------------------------------------------------------------------ 1. banners
    section("1. Banner type per site (one letter per run)")
    letter = {"reject_found": "R", "pay_or_accept": "P", "accept_only": "A",
              "no_banner_detected": "-", "blocked": "B"}
    type_counts = Counter()
    unstable = []
    for site, rs in by_site.items():
        types = [r.get("banner_type", "") for r in sorted(rs, key=lambda r: as_int(r.get("run")))]
        modal = Counter(types).most_common(1)[0][0]
        type_counts[modal] += 1
        if len(set(types)) > 1:
            unstable.append(site)
        print(f"  {short(site):24} {''.join(letter.get(t, '?') for t in types):5} {modal}")
    print("\n  Most frequent type per site:", dict(type_counts))
    print(f"  Sites whose type changed between runs: {len(unstable)}"
          + (f" ({', '.join(short(s) for s in unstable)})" if unstable else ""))

    news = [s for s in by_site if site_type.get(s) == "news"]
    pay_news = [s for s in news
                if Counter(r["banner_type"] for r in by_site[s]).most_common(1)[0][0] == "pay_or_accept"]
    if news:
        print(f"  News sites with a pay-or-accept wall: {len(pay_news)} of {len(news)}")

    # ------------------------------------------------- 2. pre-registered decision rule
    # Only runs where a real reject button was clicked are valid for the rule.
    section(f"2. Decision rule: >= {args.threshold_cookies} new tracking cookies after "
            f"rejection, on >= {args.threshold_sites} sites")
    print("  Combining the runs was not fixed in advance, so two natural rules are shown.")
    print("  median   = median over the valid runs")
    print("  majority = at least 2 valid runs above the threshold\n")
    hits_median, hits_majority = [], []
    for site, rs in by_site.items():
        valid = [r for r in rs if r.get("banner_type") == "reject_found"]
        if not valid:
            continue
        values = [as_int(r["new_tracking_after_reject"]) for r in valid]
        med = statistics.median(values)
        above = sum(v >= args.threshold_cookies for v in values)
        m_ok, j_ok = med >= args.threshold_cookies, above >= 2
        if m_ok:
            hits_median.append(site)
        if j_ok:
            hits_majority.append(site)
        flag = ("median " if m_ok else "") + ("majority" if j_ok else "")
        print(f"  {short(site):24} runs {len(valid)}  values {values!s:12} {flag}")
    n_valid_sites = sum(any(r.get("banner_type") == "reject_found" for r in rs)
                        for rs in by_site.values())
    for name, hits in (("median", hits_median), ("majority", hits_majority)):
        verdict = "MET" if len(hits) >= args.threshold_sites else "NOT MET"
        print(f"\n  {name:8}: {len(hits)} of {n_valid_sites} sites with a rejection -> {verdict}")
        print(f"            {', '.join(short(s) for s in hits)}")

    # -------------------------------------------- 3. timing-robust measure at the end
    section("3. Tracking cookies present at the end, after a real rejection (median over runs)")
    print("  Marketing cookies need consent without doubt; analytics cookies may be")
    print("  legitimate if configured as technical, which cannot be seen from outside.\n")
    mkt_sites, ana_only = [], []
    for site, rs in by_site.items():
        valid = [r for r in rs if r.get("banner_type") == "reject_found"]
        if not valid:
            continue
        mkt = [as_int(r.get("post_marketing")) for r in valid]
        ana = [as_int(r.get("post_analytics")) for r in valid]
        m_med, a_med = statistics.median(mkt), statistics.median(ana)
        stable = "stable" if len(set(mkt)) == 1 and len(set(ana)) == 1 else "varies"
        print(f"  {short(site):24} marketing {mkt!s:12} analytics {ana!s:12} {stable}")
        if m_med >= args.threshold_cookies:
            mkt_sites.append(site)
        elif a_med >= args.threshold_cookies:
            ana_only.append(site)
    print(f"\n  >= {args.threshold_cookies} marketing cookies at the end: "
          f"{len(mkt_sites)} of {n_valid_sites} -> {', '.join(short(s) for s in mkt_sites)}")
    print(f"  only analytics (>= {args.threshold_cookies}): "
          f"{len(ana_only)} -> {', '.join(short(s) for s in ana_only)}")


if __name__ == "__main__":
    main()
