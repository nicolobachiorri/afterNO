"""
Build the cookie database used by the extension.

Reads the Open Cookie Database (CSV) and our overrides.csv, the same files the
divergence test uses, and writes one compact JSON file the extension can load:

    {
      "exact":    {"_ga": ["Analytics", "Google Analytics"],
                   "_routing_id": ["Marketing", "Pinterest", ["pinterest.com"]], ...},
      "prefixes": [["_gac_gb_", "Marketing", "Google Ads"], ...],   # longest first
      "meta":     {...}
    }

The JSON keeps only what the extension needs (category, platform and, when the
database states it, the domains the cookie belongs to), so it is
small enough to ship inside the extension. Run it again whenever the CSV or the
overrides change.

Usage (from the cookie_project folder):
    python tools/build_cookie_db.py
    python tools/build_cookie_db.py --ocd path/to.csv --overrides path/to.csv --out path/to.json
"""

import argparse
import csv
import json
import re
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_OCD = HERE.parent / "divergence_work_space" / "open-cookie-database.csv"
DEFAULT_OVERRIDES = HERE.parent / "divergence_work_space" / "overrides.csv"
DEFAULT_OUT = HERE.parent / "extension" / "public" / "cookie-db.json"
DEFAULT_DESC_OUT = HERE.parent / "extension" / "public" / "cookie-desc.json"
# Placeholder texts in the database that describe nothing.
NO_DESCRIPTION = {"", "pending", "unknown", "-"}


def pick(cols, test):
    """First column whose lower-case name passes test (headers may be renamed)."""
    return next(c for c in cols if test(c.lower()))


# The Domain column is written by hand and not uniform: "pinterest.com",
# ".linkedin.com", "facebook.com (3rd party)", ".bing.com (3rd party) or
# .microsoft.com (3rd party)", "or 207.net (3rd party)". We keep only the host
# names in it. The extension reduces them to sites with the same rule it uses
# everywhere else (siteOf in lib/hosts.ts), so the rule lives in one place.
HOST = re.compile(r"[a-z0-9-]+(?:\.[a-z0-9-]+)+")


def owners(raw):
    found = []
    for host in HOST.findall((raw or "").lower()):
        if re.fullmatch(r"[\d.]+", host) or not re.search(r"[a-z]", host.split(".")[-1]):
            continue  # IP addresses and numbers are not owners
        if host not in found:
            found.append(host)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ocd", type=Path, default=DEFAULT_OCD)
    ap.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--desc-out", type=Path, default=DEFAULT_DESC_OUT)
    args = ap.parse_args()

    exact, prefixes = {}, {}
    # Descriptions go to a separate file: they are large (about 240 KB) and only the
    # popup shows them, so the background never loads them.
    desc_exact, desc_prefixes = {}, {}

    with open(args.ocd, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        name_col = pick(cols, lambda c: "name" in c or "key" in c)
        cat_col = pick(cols, lambda c: c.startswith("category"))
        wild_col = pick(cols, lambda c: "wildcard" in c)
        plat_col = pick(cols, lambda c: c.startswith("platform"))
        dom_col = pick(cols, lambda c: c == "domain")
        desc_col = pick(cols, lambda c: c.startswith("description"))
        n_ocd = n_owned = 0
        for row in reader:
            name = (row[name_col] or "").strip()
            if not name:
                continue
            entry = [(row[cat_col] or "Unknown").strip(), (row[plat_col] or "").strip()]
            hosts = owners(row[dom_col])
            if hosts:  # only when known, to keep the file small
                entry.append(hosts)
                n_owned += 1
            wildcard = (row[wild_col] or "0").strip() == "1"
            (prefixes if wildcard else exact)[name] = entry
            text = " ".join((row[desc_col] or "").split())
            desc_target = desc_prefixes if wildcard else desc_exact
            if text.lower() in NO_DESCRIPTION:
                desc_target.pop(name, None)
            else:
                desc_target[name] = text
            n_ocd += 1

    # Overrides win over the database, exactly as in divergence_test.py.
    n_over = 0
    if args.overrides.exists():
        with open(args.overrides, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                name = (row.get("name") or "").strip()
                if not name or name.startswith("#"):
                    continue
                source = row.get("source") or ""
                entry = [row["category"].strip(), source.split(":")[0].strip()]
                is_prefix = (row.get("match") or "exact").strip() == "prefix"
                (prefixes if is_prefix else exact)[name] = entry
                # The database's description would contradict our category: use our
                # source ("Criteo: retargeting identifier" -> "retargeting identifier").
                desc_target = desc_prefixes if is_prefix else desc_exact
                ours = source.split(":", 1)[1].strip() if ":" in source else ""
                ours = re.sub(r"\s*\([^)]*\)\s*$", "", ours)  # drop our notes in brackets
                if ours:
                    desc_target[name] = ours[0].upper() + ours[1:]
                else:
                    desc_target.pop(name, None)
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
            "entries_with_owner_domains": n_owned,
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(db, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_kb = args.out.stat().st_size / 1024
    print(f"{len(db['exact'])} exact names, {len(db['prefixes'])} prefixes "
          f"({n_ocd} from the database, {n_owned} with owner domains, {n_over} overrides) -> {args.out} ({size_kb:.0f} KB)")

    desc = {
        "exact": dict(sorted(desc_exact.items())),
        "prefixes": [[p, d] for p, d in sorted(desc_prefixes.items(), key=lambda kv: -len(kv[0]))],
        "meta": {"source": db["meta"]["source"], "language": "en", "generated": db["meta"]["generated"]},
    }
    args.desc_out.write_text(json.dumps(desc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(desc['exact']) + len(desc['prefixes'])} descriptions (English) -> {args.desc_out} "
          f"({args.desc_out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
