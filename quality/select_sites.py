"""
Draw the sample of sites for the quality measurement (see PROTOCOL.md).

Fixed in advance, before any result is seen:
  - 20 sites from step 1 (divergence_work_space/sites.csv), excluding the sites
    already tested by hand while developing the extension;
  - 20 .it domains from the Tranco list (top 2000 .it domains), excluding the same
    sites and those of step 1. The whole shuffled list is written, not only 20:
    a site that cannot be measured as a visitor page (see PROTOCOL.md) is replaced
    by the next one, and the replacement is recorded.
The random seed is fixed, so anyone with the same Tranco list gets the same sample.

Usage (from the quality folder):
    python3 select_sites.py --tranco top-1m.csv --tranco-id XXXXX
"""

import argparse
import csv
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEED = 20261029
STEP1 = HERE.parent / "divergence_work_space" / "sites.csv"
OUT = HERE / "sites.csv"

# Tested by hand during development: the code was adjusted on them, so measuring on
# them would make the result look better than it is.
SEEN = {"ilmeteo.it", "ikea.com", "corriere.it", "ilfattoquotidiano.it",
        "zara.com", "pinterest.com", "thefork.it"}
N_STEP1, N_TRANCO, TRANCO_POOL = 20, 20, 2000


def site(host):
    host = host.lower().strip().split("/")[0]
    host = host.split("://")[-1] if "://" in host else host
    return ".".join(host.split(".")[-2:])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tranco", type=Path, required=True, help="top-1m.csv from tranco-list.eu")
    ap.add_argument("--tranco-id", required=True, help="the list's permanent ID, shown on tranco-list.eu")
    args = ap.parse_args()
    rng = random.Random(SEED)

    with open(STEP1, encoding="utf-8") as f:
        step1 = [r["url"] for r in csv.DictReader(f)]
    step1_sites = {site(u.split("://")[1]) for u in step1}
    pool1 = sorted(u for u in step1 if site(u.split("://")[1]) not in SEEN)
    chosen1 = rng.sample(pool1, N_STEP1)

    it_domains = []
    with open(args.tranco, encoding="utf-8") as f:
        for rank, domain in csv.reader(f):
            if domain.endswith(".it") and site(domain) not in SEEN | step1_sites:
                it_domains.append((int(rank), domain))
                if len(it_domains) == TRANCO_POOL:
                    break
    rng.shuffle(it_domains)

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["order", "url", "source", "tranco_rank", "role"])
        for i, u in enumerate(chosen1, 1):
            w.writerow([i, u, "step1", "", "sample"])
        for i, (rank, domain) in enumerate(it_domains, 1):
            role = "sample" if i <= N_TRANCO else "reserve"
            w.writerow([N_STEP1 + i, f"https://www.{domain}" if domain.count(".") == 1 else f"https://{domain}",
                        f"tranco:{args.tranco_id}", rank, role])
    print(f"{N_STEP1} from step 1, {N_TRANCO} from Tranco {args.tranco_id} "
          f"(+{len(it_domains) - N_TRANCO} reserves) -> {OUT}")


if __name__ == "__main__":
    main()
