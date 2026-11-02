"""
Sample D (see PROTOCOL.md, modification 18): 40 new sites, to measure the version
with the corrections made after sample C.

Same rule as sample C: sites.csv holds the whole Tranco list shuffled with the fixed
seed; sample D is the first 40 reserves left after sample C (the rows sites_C.csv
still marks "reserve"), in order. A site that breaks the replacement rules of
PROTOCOL.md is listed in REPLACED with its reason and gives its place to the next.

Usage (from the quality folder):
    python3 select_sample_d.py          # writes sites_D.csv
"""

import csv
from pathlib import Path

HERE = Path(__file__).resolve().parent
N = 40

# Tranco sites of sample D replaced under the rules of PROTOCOL.md: domain -> reason.
REPLACED = {
    # Decided before the first visit, from the name alone (clear cases only).
    "netwin.it": "adults only (gambling)",
}


def domain_of(url):
    host = url.split("://")[1].split("/")[0]
    return host[4:] if host.startswith("www.") else host


def main():
    with open(HERE / "sites_C.csv", encoding="utf-8") as f:
        reserves = [r for r in csv.DictReader(f) if r["role"] == "reserve"]
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
    with open(HERE / "sites_D.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["order", "url", "source", "tranco_rank", "role"])
        w.writeheader()
        w.writerows(out)
    print(f"{used} sites in sample D (from order {out[0]['order']}), "
          f"{len(REPLACED)} replaced -> {HERE / 'sites_D.csv'}")


if __name__ == "__main__":
    main()
