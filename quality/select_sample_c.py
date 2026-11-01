"""
Sample C (visits C1 and C2, see PROTOCOL.md, modification 10): 40 new sites on which
the extension has never been tried, for the accuracy that gets published.

Taken from sites.csv, which already holds the whole Tranco list shuffled with the
fixed seed: the first 40 reserves not used by sample A/B, in order. A site that
breaks the replacement rules of PROTOCOL.md is listed in REPLACED with its reason and
gives its place to the next free reserve, exactly as for sample A/B.

Usage (from the quality folder):
    python3 select_sample_c.py          # writes sites_C.csv
"""

import csv
from pathlib import Path

HERE = Path(__file__).resolve().parent
N = 40

# Tranco sites of sample C replaced under the rules of PROTOCOL.md: domain -> reason.
REPLACED = {
    # Decided before the first visit, from the name alone (clear cases only).
    "lottomatica.it": "adults only (gambling)",
    "betflag.it": "adults only (gambling)",
    # Found at visit C1: the home page does not load.
    "polymoon.it": "does not load (domain not found)",
    "maggiolicloud.it": "does not load (domain not found)",
    "tiristorantemipizzeria.it": "does not load (server error)",
    "mvmnet.it": "does not load (invalid certificate)",
    "e-pal.it": "does not load (invalid certificate)",
    "qcom.it": "does not load (connection reset)",
    "val.it": "does not load (domain not found)",
}


def domain_of(url):
    host = url.split("://")[1].split("/")[0]
    return host[4:] if host.startswith("www.") else host


def main():
    with open(HERE / "sites.csv", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    reserves = [r for r in rows if r["role"] == "reserve"]
    out, used = [], 0
    for r in reserves:
        if used == N:
            role = "reserve"
        elif domain_of(r["url"]) in REPLACED:
            role = f"replaced: {REPLACED[domain_of(r['url'])]}"
        else:
            role = "sample"
            used += 1
        out.append({**r, "role": role})
    with open(HERE / "sites_C.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["order", "url", "source", "tranco_rank", "role"])
        w.writeheader()
        w.writerows(out)
    print(f"{used} sites in sample C (from order {out[0]['order']}), "
          f"{len(REPLACED)} replaced -> {HERE / 'sites_C.csv'}")


if __name__ == "__main__":
    main()
