"""
Do the pieces of the project agree with each other?

The project says the same things in several places (the extension's texts in two
languages, README, the website, the store listing, the measurement files). This script
checks the ones a machine can check, and fails if any of them drifted:

  1. translations: the same keys and the same placeholders in Italian and English;
  2. the store listing's short descriptions are the ones in the translations;
  3. cookie database: every local correction (overrides.csv) is in the built JSON;
  4. website: it loads nothing from other sites, as it promises;
  5. privacy policy: same "last updated" date in both languages;
  6. the author's rules: no long dashes in the texts people read;
  7. Python scripts compile;
  8. measurement: the summaries in quality/runs/ are what analyze.py computes today
     from the judgments, and the numbers of round G in README and on the website are
     the ones score_g.py computes.

Usage (from the project folder):  python3 tools/check_integrity.py
Exit code 0 when everything agrees, 1 otherwise.
"""

import csv
import json
import py_compile
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
problems = []


def check(ok, message):
    if not ok:
        problems.append(message)


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def translations():
    it = json.loads(read("extension/public/_locales/it/messages.json"))
    en = json.loads(read("extension/public/_locales/en/messages.json"))
    check(set(it) == set(en), f"translations: keys differ: {sorted(set(it) ^ set(en))}")
    for key in set(it) & set(en):
        a = set(re.findall(r"\$[A-Z_0-9]+\$", it[key]["message"]))
        b = set(re.findall(r"\$[A-Z_0-9]+\$", en[key]["message"]))
        check(a == b, f"translations: placeholders differ in {key}")
    listing = read("store/LISTING.md")
    for lang, messages in (("it", it), ("en", en)):
        text = messages["extDescription"]["message"]
        check(text in listing, f"store listing: short description ({lang}) differs from the translations")
        check(len(text) <= 132, f"translations: extDescription ({lang}) is longer than 132 characters")
    package = json.loads(read("extension/package.json"))
    check(re.fullmatch(r"\d+\.\d+\.\d+", package["version"]) is not None, "package.json: version is not x.y.z")


def cookie_db():
    db = json.loads(read("extension/public/cookie-db.json"))
    prefixes = {p[0]: p[1] for p in db["prefixes"]}
    with open(ROOT / "divergence_work_space" / "overrides.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip()
            if not name or name.startswith("#"):
                continue
            if (row.get("match") or "exact").strip() == "prefix":
                found = prefixes.get(name)
            else:
                found = (db["exact"].get(name) or [None])[0]
            check(found == row["category"].strip(),
                  f"cookie database: override {name} is not in cookie-db.json (run npm run db)")


def website():
    html = read("docs/index.html")
    loads = (re.findall(r"""(?:src|srcset|poster)=["'](?:https?:)?//[^"']+""", html)
             + re.findall(r"""<link[^>]+href=["'](?:https?:)?//[^"']+""", html)
             + re.findall(r"""url\(["']?(?:https?:)?//[^)]+""", html)
             + re.findall(r"@import[^;]+", html)
             + re.findall(r"\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|new EventSource", html))
    check(not loads, f"website: loads or requests found: {loads[:3]}")
    readme = read("README.md")
    for store in ("chromewebstore.google.com/detail/afterno/", "addons.mozilla.org/addon/afterno/"):
        check(store in html and store in readme, f"store link missing in README or website: {store}")


def privacy():
    dates = re.findall(r"\*(?:Last updated|Ultimo aggiornamento): (\d+) (\w+) (\d{4})", read("PRIVACY.md"))
    months = {"gennaio": "January", "febbraio": "February", "marzo": "March", "aprile": "April",
              "maggio": "May", "giugno": "June", "luglio": "July", "agosto": "August",
              "settembre": "September", "ottobre": "October", "novembre": "November", "dicembre": "December"}
    same = len(dates) == 2 and dates[0][0] == dates[1][0] and dates[0][2] == dates[1][2] \
        and dates[0][1] == months.get(dates[1][1])
    check(same, f"privacy policy: the two dates differ or are missing: {dates}")


def style():
    texts = ["README.md", "PRIVACY.md", "store/LISTING.md", "docs/index.html",
             "extension/public/_locales/it/messages.json", "extension/public/_locales/en/messages.json"]
    for path in texts:
        check("—" not in read(path), f"style: long dash in {path}")


def scripts():
    for folder in ("tools", "quality", "store", "divergence_work_space"):
        for path in sorted((ROOT / folder).glob("*.py")):
            try:
                py_compile.compile(str(path), doraise=True, cfile=str(Path("/tmp") / (path.name + "c")))
            except py_compile.PyCompileError as error:
                check(False, f"script does not compile: {path.relative_to(ROOT)}: {error.msg.strip()}")


def measurement():
    quality = ROOT / "quality"
    runs = quality / "runs"
    for summary in sorted(runs.glob("*/summary.md")):
        visit = summary.parent.name
        judgments = {p.stem.split("_")[-1] for p in summary.parent.glob(f"judgments_{visit}_*.csv")}
        if not {"claude", "gemini"} <= judgments:
            continue
        before = summary.read_text(encoding="utf-8")
        done = subprocess.run([sys.executable, "analyze.py", "--visit", visit, "--primary", "claude",
                               "--second", "gemini"], cwd=quality, capture_output=True, text=True)
        check(done.returncode == 0, f"measurement: analyze.py fails on visit {visit}")
        after = summary.read_text(encoding="utf-8")
        if after != before:
            summary.write_text(before, encoding="utf-8")  # leave the files as they were
        check(after == before, f"measurement: runs/{visit}/summary.md is not what analyze.py computes today")

    if not (runs / "G1" / "results.csv").exists():
        return
    done = subprocess.run([sys.executable, "score_g.py", "--visit", "G1"], cwd=quality, capture_output=True, text=True)
    check(done.returncode == 0, "measurement: score_g.py fails on visit G1")
    readme, html = read("README.md"), read("docs/index.html")
    for row in ("Rejection recorded", "Right verdict, when recorded (main judge)"):
        found = re.search(rf"\| {re.escape(row)} \| (\d+) of (\d+): (\d+)% \((\d+)-(\d+)%\) \|", done.stdout)
        if not found:
            check(False, f"measurement: row '{row}' not found in score_g.py's output")
            continue
        k, n, share, low, high = found.groups()
        check(f"{k} of {n}: {share}% ({low}-{high}%)" in readme, f"README: round G, '{row}' is not {k} of {n}")
        check(f"{k} of {n} · {share}% ({low}–{high}%)" in html, f"website (EN): round G, '{row}' is not {k} of {n}")
        check(f"{k} su {n} · {share}% ({low}–{high}%)" in html, f"website (IT): round G, '{row}' is not {k} su {n}")


def main():
    for part in (translations, cookie_db, website, privacy, style, scripts, measurement):
        part()
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print(" -", p)
        return 1
    print("Everything agrees: translations, store listing, cookie database, website, "
          "privacy policy, style, scripts, measurement.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
