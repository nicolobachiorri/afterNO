"""
Sample E (see PROTOCOL.md, modification 23): 40 sites of other EU countries, to
measure the banner buttons in the eight languages (modifications 21 and 22) and, with
two visits E1 and E2 of the same version, accuracy and stability together.

Fixed in advance, before any result is seen:
  - eight country domains, one per language the extension and the robot know besides
    Italian: .de (German), .at (German, a second country), .fr (French), .es (Spanish),
    .pt (Portuguese), .nl (Dutch), .pl (Polish), .ie (English);
  - for each, the first 500 domains of the Tranco list ZJ8PG, shuffled with the same
    seed as the other samples; the first 5 are the sample, the rest reserves of the
    same country, in order;
  - excluded: sites tested by hand during development and the two sites used as
    pilots for the robot (bahn.de, decathlon.fr).
Each site is visited with the browser language and time zone of its country (column
"locale"), as a resident would; the popup stays in Italian for the judge.

A site that breaks the replacement rules of PROTOCOL.md is listed in REPLACED with its
reason and gives its place to the first free reserve of the same country.

Usage (from the quality folder):
    python3 select_sample_e.py          # writes sites_E.csv
"""

import csv
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEED = 20261029
PER_COUNTRY, POOL = 5, 500
FIRST_ORDER = 3001
COUNTRIES = [  # tld, browser locale, time zone
    ("de", "de-DE", "Europe/Berlin"),
    ("at", "de-AT", "Europe/Vienna"),
    ("fr", "fr-FR", "Europe/Paris"),
    ("es", "es-ES", "Europe/Madrid"),
    ("pt", "pt-PT", "Europe/Lisbon"),
    ("nl", "nl-NL", "Europe/Amsterdam"),
    ("pl", "pl-PL", "Europe/Warsaw"),
    ("ie", "en-IE", "Europe/Dublin"),
]
EXCLUDED = {"bahn.de", "decathlon.fr"}  # robot pilots

# Sites of sample E replaced under the rules of PROTOCOL.md: domain -> reason.
REPLACED = {
    # Decided before the first visit, from the name alone (clear cases only).
    "casino-portugal.pt": "adults only (gambling)",
    "hdfilmcehennemi.nl": "pirated film streaming",
    # Found at visit E1: the home page does not load.
    "t-ipnet.de": "does not load (domain not found)",
}

# Two-label public suffixes used in these countries, so that "x.com.pl" is one site.
TWO_LABEL = {"com.pl", "net.pl", "org.pl", "gov.pl", "edu.pl", "co.at", "or.at", "gv.at",
             "ac.at", "com.es", "org.es", "gob.es", "gouv.fr", "com.pt", "gov.pt",
             "gov.ie", "co.nl"}


def site(domain):
    parts = domain.lower().split(".")
    return ".".join(parts[-3:]) if ".".join(parts[-2:]) in TWO_LABEL else ".".join(parts[-2:])


def main():
    from select_sites import SEEN
    rng = random.Random(SEED)
    pools = {tld: [] for tld, _, _ in COUNTRIES}
    seen_sites = set()
    with open(HERE / "top-1m.csv", encoding="utf-8") as f:
        for rank, domain in csv.reader(f):
            tld = domain.rsplit(".", 1)[-1]
            if tld not in pools or len(pools[tld]) >= POOL:
                continue
            s = site(domain)
            if s in SEEN | EXCLUDED | seen_sites:
                continue
            seen_sites.add(s)
            pools[tld].append((int(rank), s))

    rows, order = [], FIRST_ORDER
    for tld, locale, tz in COUNTRIES:
        pool = pools[tld]
        rng.shuffle(pool)
        taken = 0
        for rank, s in pool:
            if s in REPLACED:
                role = f"replaced: {REPLACED[s]}"
            elif taken < PER_COUNTRY:
                role, taken = "sample", taken + 1
            else:
                role = "reserve"
            rows.append({"order": order, "url": f"https://www.{s}", "source": "tranco:ZJ8PG",
                         "tranco_rank": rank, "role": role, "locale": locale, "timezone": tz})
            order += 1

    with open(HERE / "sites_E.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        if r["role"] == "sample":
            print(r["order"], r["locale"], r["url"])


if __name__ == "__main__":
    main()
