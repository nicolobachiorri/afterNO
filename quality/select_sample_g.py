"""
Sample G (see PROTOCOL.md, modification 38): 40 new sites to measure the version
published in the stores (from 0.1.1), with a robot that does not share the extension's
vocabulary.

Fixed before any visit: the next 16 reserves of the Italian list (sites_D.csv, in the
order already set by the seed) and, for each of the eight EU countries, the next 3
reserves of sites_F.csv. Italian sites get the Italian browser language and time zone.
A site that breaks the replacement rules of PROTOCOL.md is listed in REPLACED with its
reason and gives its place to the next reserve of the same group.

Usage (from the quality folder):
    python3 select_sample_g.py          # writes sites_G.csv
"""

import csv
from pathlib import Path

HERE = Path(__file__).resolve().parent
ITALIAN = 16
PER_COUNTRY = 3

# Sites of sample G replaced under the rules of PROTOCOL.md: domain -> reason.
REPLACED = {
    # Found while marking the buttons (label_buttons.py, 10 November 2026): the home
    # page does not load.
    "broadspeed.it": "does not load (domain not found)",
    "ioam.de": "does not load (SSL error)",
    "ns.ie": "does not load (domain not found)",
    "slon6.at": "does not load (timeout, then domain not found)",
}


def domain_of(url):
    host = url.split("://")[1].split("/")[0]
    return host[4:] if host.startswith("www.") else host


def main():
    out = []
    with open(HERE / "sites_D.csv", encoding="utf-8") as f:
        italian = [r for r in csv.DictReader(f) if r["role"] == "reserve"]
    n = 0
    for r in italian:
        if n >= ITALIAN:
            break
        role = f"replaced: {REPLACED[domain_of(r['url'])]}" if domain_of(r["url"]) in REPLACED else "sample"
        n += role == "sample"
        out.append({**r, "role": role, "locale": "it-IT", "timezone": "Europe/Rome"})
    with open(HERE / "sites_F.csv", encoding="utf-8") as f:
        eu = [r for r in csv.DictReader(f) if r["role"] == "reserve"]
    taken = {}
    for r in eu:
        country = r["locale"]
        if taken.get(country, 0) >= PER_COUNTRY:
            continue
        if domain_of(r["url"]) in REPLACED:
            out.append({**r, "role": f"replaced: {REPLACED[domain_of(r['url'])]}"})
            continue
        taken[country] = taken.get(country, 0) + 1
        out.append({**r, "role": "sample"})
    with open(HERE / "sites_G.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["order", "url", "source", "tranco_rank", "role", "locale", "timezone"])
        w.writeheader()
        w.writerows(out)
    for r in out:
        if r["role"] == "sample":
            print(r["order"], r["locale"], r["url"])
    print(sum(r["role"] == "sample" for r in out), "sites")


if __name__ == "__main__":
    main()
