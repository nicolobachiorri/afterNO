"""
Sample F (see PROTOCOL.md, modification 27): 40 new sites of the same eight EU
countries as sample E, to measure the corrections made after visit E2 (modifications
24-26): reject words with other words in between, "I ..." in English, "no thanks" in
every language, the Polish forms, the "save" button, the ac.at suffix and the
corrected label of Segment.

Same rule as sample E, fixed before any visit: for each country, the first 5 reserves
of sites_E.csv still free, in the order already set by the seed. Same browser
language and time zone per country. A site that breaks the replacement rules of
PROTOCOL.md is listed in REPLACED with its reason and gives its place to the next
reserve of the same country.

Usage (from the quality folder):
    python3 select_sample_f.py          # writes sites_F.csv
"""

import csv
from pathlib import Path

HERE = Path(__file__).resolve().parent
PER_COUNTRY = 5

# Sites of sample F replaced under the rules of PROTOCOL.md: domain -> reason.
REPLACED = {
    # Decided before the first visit, from the name alone (clear cases only).
    "turfpronos.fr": "adults only (betting tips)",
    "blogspot.com.es": "technical service (Blogger's country alias)",
    "bb-dns.nl": "technical service (DNS)",
    # Found at visit F1: the browser hangs while loading the page, every time.
    "rbb24.de": "the robot's browser hangs on loading (visit F1)",
    # Found at visit F1: the home page does not load.
    "styriapress.at": "does not load (connection refused)",
    "archi.fr": "does not load (domain not found)",
    "dropped.net.pl": "does not load (domain not found)",
    "wroc.pl": "does not load (domain not found)",
    "myspreadshop.ie": "does not load (domain not found)",
    "inode.at": "does not load (timeout, twice)",
    "careview.pt": "does not load (timeout, twice)",
    "salespaginakit.nl": "does not load (timeout, twice)",
}


def main():
    with open(HERE / "sites_E.csv", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    taken = {}
    out = []
    for r in rows:
        country = r["locale"]
        domain = r["url"].split("://www.", 1)[-1]
        if r["role"] != "reserve":
            continue
        if domain in REPLACED:
            role = f"replaced: {REPLACED[domain]}"
        elif taken.get(country, 0) < PER_COUNTRY:
            role = "sample"
            taken[country] = taken.get(country, 0) + 1
        else:
            role = "reserve"
        out.append({**r, "role": role})
    with open(HERE / "sites_F.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)
    for r in out:
        if r["role"] == "sample":
            print(r["order"], r["locale"], r["url"])


if __name__ == "__main__":
    main()
