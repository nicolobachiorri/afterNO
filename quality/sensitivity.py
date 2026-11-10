"""
How much do the two time thresholds change the conclusions?

  MIN_IDENTIFIER_DAYS (lib/identifiers.ts, 30): an unknown third-party cookie, sent
      from any site (SameSite=None), counts as a "likely identifier" from this lifetime.
  SHORT_LIVED_MS (lib/verdict.ts, 1 day): a marketing cookie of the site itself that
      expires within this time does not count against the rejection.

Both are our choices. This script recomputes, with the extension's own code, the
conclusion of every rejection recorded in the saved visits, once per value, and counts
the conclusions that change (respected <-> only partly respected). Nothing is visited
again: it reads runs/<visit>/<site>/raw.json and verdict.json.

The extension's code is copied to a temporary folder and only there are the two
constants read from environment variables; the extension itself is not changed.

Usage (from quality/):  python3 sensitivity.py
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXT = HERE.parent / "extension"
VISITS = ["A", "B", "C1", "C2", "D1", "E1", "E2", "F1", "F2", "G1"]
ID_DAYS = [1, 7, 30, 90, 180, 395]
SHORT_DAYS = [0, 1, 7, 30, 90]


def patch(lib: Path):
    ident = lib / "identifiers.ts"
    s = ident.read_text()
    s, n1 = re.subn(r"export const MIN_IDENTIFIER_DAYS = 30;",
                    "export const MIN_IDENTIFIER_DAYS = Number(process.env.ID_DAYS ?? 30);", s)
    ident.write_text(s)
    ver = lib / "verdict.ts"
    s = ver.read_text()
    s, n2 = re.subn(r"export const SHORT_LIVED_MS = 86_400_000;",
                    "export const SHORT_LIVED_MS = Number(process.env.SHORT_DAYS ?? 1) * 86_400_000;", s)
    ver.write_text(s)
    if n1 != 1 or n2 != 1:
        raise SystemExit("the thresholds are no longer written as expected: update patch()")


def run(work: Path, env: dict) -> dict:
    out = subprocess.run(["node", str(work / "sensitivity_verdict.ts"), str(HERE), *VISITS],
                         env={**os.environ, "COOKIE_DB": str(EXT / "public" / "cookie-db.json"), **env},
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def side(tone: str) -> str:
    return "respected" if tone == "ok" else "partly"


def main():
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        shutil.copytree(EXT / "lib", work / "lib")
        shutil.copy(HERE / "sensitivity_verdict.ts", work)
        patch(work / "lib")
        base = run(work, {})
        print(f"Recorded rejections in visits {', '.join(VISITS)}: {len(base)} "
              f"({len({k.split('/', 1)[1].split('_', 1)[1] for k in base})} different sites)")
        same = [k for k, v in base.items() if v.split("|")[0] == v.split("|")[1]]
        print(f"Recomputed with today's code and the default thresholds: {len(same)} give the "
              f"same tone as at the time of the visit (the others were measured with older versions).")
        print()
        print("| threshold | value | conclusions that change |")
        print("| --- | --- | --- |")
        for name, var, values in (("likely identifier, minimum days", "ID_DAYS", ID_DAYS),
                                  ("site's marketing cookie ignored if it expires within, days", "SHORT_DAYS", SHORT_DAYS)):
            for v in values:
                res = run(work, {var: str(v)})
                changed = [k for k in base if side(res[k].split("|")[0]) != side(base[k].split("|")[0])]
                print(f"| {name} | {v} | {len(changed)}" + (f": {', '.join(changed)}" if changed else "") + " |")


if __name__ == "__main__":
    main()
