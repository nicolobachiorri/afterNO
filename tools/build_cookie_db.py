"""
Build the cookie database used by the extension.

Reads the Open Cookie Database (CSV) and our overrides.csv, the same files the
divergence test uses, and writes one compact JSON file the extension can load:

    {
      "exact":    {"_ga": ["Analytics", "Google Analytics"], ...},
      "prefixes": [["_gac_gb_", "Marketing", "Google Ads"], ...],   # longest first
      "meta":     {...}
    }

The JSON keeps only what the extension needs (category and platform), so it is
small enough to ship inside the extension. Run it again whenever the CSV or the
overrides change.

Usage (from the cookie_project folder):
    python tools/build_cookie_db.py
    python tools/build_cookie_db.py --ocd path/to.csv --overrides path/to.csv --out path/to.json
"""

import argparse
import csv
import json
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_OCD = HERE.parent / "divergence_work_space" / "open-cookie-database.csv"
DEFAULT_OVERRIDES = HERE.parent / "divergence_work_space" / "overrides.csv"
DEFAULT_OUT = HERE.parent / "extension" / "public" / "cookie-db.json"


def pick(cols, test):
    """First column whose lower-case name passes test (headers may be renamed)."""
    return next(c for c in cols if test(c.lower()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ocd", type=Path, default=DEFAULT_OCD)
    ap.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    exact, prefixes = {}, {}

    with open(args.ocd, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        name_col = pick(cols, lambda c: "name" in c or "key" in c)
        cat_col = pick(cols, lambda c: c.startswith("category"))
        wild_col = pick(cols, lambda c: "wildcard" in c)
        plat_col = pick(cols, lambda c: c.startswith("platform"))
        n_ocd = 0
        for row in reader:
            name = (row[name_col] or "").strip()
            if not name:
                continue
            entry = [(row[cat_col] or "Unknown").strip(), (row[plat_col] or "").strip()]
            target = prefixes if (row[wild_col] or "0").strip() == "1" else exact
            target[name] = entry
            n_ocd += 1

    # Overrides win over the database, exactly as in divergence_test.py.
    n_over = 0
    if args.overrides.exists():
        with open(args.overrides, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                name = (row.get("name") or "").strip()
                if not name or name.startswith("#"):
                    continue
                entry = [row["category"].strip(), (row.get("source") or "").split(":")[0].strip()]
                target = prefixes if (row.get("match") or "exact").strip() == "prefix" else exact
                target[name] = entry
                n_over += 1

    db = {
        "exact": dict(sorted(exact.items())),
        # Longest prefix first, so the most specific one wins.
        "prefixes": [[p, *v] for p, v in sorted(prefixes.items(), key=lambda kv: -len(kv[0]))],
        "meta": {
            "source": "Open Cookie Database, https://github.com/jkwakman/Open-Cookie-Database "
                      "(Apache-2.0), plus local overrides",
            "generated": date.today().isoformat(),
            "entries_from_database": n_ocd,
            "entries_from_overrides": n_over,
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(db, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_kb = args.out.stat().st_size / 1024
    print(f"{len(db['exact'])} exact names, {len(db['prefixes'])} prefixes "
          f"({n_ocd} from the database, {n_over} overrides) -> {args.out} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
