"""
Score a visit of sample G (PROTOCOL.md, modifications 36-38) with the two separate
numbers published since 10 November 2026:

- rejection recorded: on the sites where a person marked a free reject control and the
  robot clicked it, how often the extension recorded a rejection (a missing record, or
  an acceptance, is an error of the extension);
- right verdict, when recorded: of those, how many conclusions the main judge found
  correct; and, when an external judge answered blind, how often the blind answer
  ("can a third party still recognise you?") matches the extension's conclusion.

Usage (from the quality folder):
    python3 score_g.py --visit G1
Reads sites_G.csv, runs/G0/labels_G.csv, runs/<visit>/results.csv and, when present,
runs/<visit>/judgments_<visit>_claude.csv (main judge), _gemini.csv (second judge, sees
everything) and _blind.csv (blind judge). Prints the table and saves it as
runs/<visit>/score.md.
"""

import argparse
import csv
import sys
from math import sqrt
from pathlib import Path

HERE = Path(__file__).resolve().parent


def wilson(k, n, z=1.96):
    if n == 0:
        return (0, 0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return round(100 * (c - h)), round(100 * (c + h))


def share(k, n):
    if n == 0:
        return "-"
    lo, hi = wilson(k, n)
    return f"{k} of {n}: {round(100 * k / n)}% ({lo}-{hi}%)"


def read(path):
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return {r["order"]: r for r in csv.DictReader(f)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--visit", default="G1")
    args = ap.parse_args()
    run = HERE / "runs" / args.visit
    sample = [o for o, r in read(HERE / "sites_G.csv").items() if r["role"] == "sample"]
    labels = read(HERE / "runs" / "G0" / "labels_G.csv")
    results = read(run / "results.csv")
    judged = read(run / f"judgments_{args.visit}_claude.csv")
    second = read(run / f"judgments_{args.visit}_gemini.csv")  # second judge, sees everything
    blind = read(run / f"judgments_{args.visit}_blind.csv")

    free = [o for o in sample if labels.get(o, {}).get("answer") == "control"]
    # "Save" with only the necessary cookies switched on by default (no explicit reject
    # button): a rejection for the user, but the extension cannot see the toggles.
    # Measured and reported apart, not mixed with the explicit rejections.
    saves = [o for o in sample if labels.get(o, {}).get("answer") == "save_defaults"]
    saves_rec = [o for o in saves if results.get(o, {}).get("reject_clicked") == "True"
                 and results[o].get("choice_recorded") == "rejected"]
    # A click the robot could not make, or a page that blocked the robot after it, says
    # nothing about the extension: left out, and listed (main judge, "no_click", "no_blocked").
    robot_limit = [o for o in free if judged.get(o, {}).get("measurable") in ("no_click", "no_blocked")]
    clicked = [o for o in free if results.get(o, {}).get("reject_clicked") == "True" and o not in robot_limit]
    not_clicked = [o for o in free if o not in clicked]  # robot limits included
    recorded = [o for o in clicked if results[o].get("choice_recorded") == "rejected"]
    as_accept = [o for o in clicked if results[o].get("choice_recorded") == "accepted"]
    missing = [o for o in clicked if not results[o].get("choice_recorded")]
    spurious = [o for o in sample if o not in free and labels.get(o, {}).get("answer") != "save_defaults"
                and results.get(o, {}).get("choice_recorded") == "rejected"]
    right = [o for o in recorded if judged.get(o, {}).get("conclusion") == "correct"]
    second_pairs = [o for o in recorded if second.get(o, {}).get("conclusion")]
    second_agree = [o for o in second_pairs if second[o]["conclusion"] == judged.get(o, {}).get("conclusion")]
    tone_to_blind = {"ok": "respected", "warn": "partly", "alert": "partly"}
    blind_pairs = [o for o in recorded if blind.get(o, {}).get("conclusion") in ("respected", "partly")]
    blind_agree = [o for o in blind_pairs if tone_to_blind.get(results[o].get("tone")) == blind[o]["conclusion"]]

    answers = {}
    for o in sample:
        a = labels.get(o, {}).get("answer") or "no label"
        answers[a] = answers.get(a, 0) + 1

    print(f"Visit {args.visit}, sample G: {len(sample)} sites")
    print("Labels:", ", ".join(f"{k} {v}" for k, v in sorted(answers.items())))
    print(f"Free reject marked: {len(free)}; clicked and checkable: {len(clicked)}"
          + (f"; not clicked: {', '.join(not_clicked)}" if not_clicked else ""))
    print()
    print("| | sample G |")
    print("| --- | --- |")
    print(f"| Rejection recorded | {share(len(recorded), len(clicked))} |")
    print(f"| of which: not recorded / recorded as acceptance | {len(missing)} / {len(as_accept)} |")
    print(f"| Rejection recorded where there was none | {len(spurious)} |")
    print(f"| \"Save\" with only necessary on, recorded as rejection | {len(saves_rec)} of {len(saves)} |")
    print(f"| Right verdict, when recorded (main judge) | {share(len(right), len(recorded)) if judged else 'not judged yet'} |")
    print(f"| Second judge agrees with the main judge | {share(len(second_agree), len(second_pairs)) if second else 'not judged yet'} |")
    print(f"| Blind judge agrees with the conclusion | {share(len(blind_agree), len(blind_pairs)) if blind else 'not judged yet'} |")
    blind_unsure = [o for o in recorded if blind.get(o, {}).get("conclusion") == "unsure"]
    if blind_unsure:
        print(f"| Blind judge unsure (left out above) | {len(blind_unsure)} |")
    for name, rows in (("Not recorded", missing), ("Recorded as acceptance", as_accept), ("Spurious", spurious),
                       ("Second judge disagreement", [o for o in second_pairs if o not in second_agree]),
                       ("Blind disagreement", [o for o in blind_pairs if o not in blind_agree])):
        if rows:
            print(f"\n{name}: " + ", ".join(f"{o} {results[o]['url']}" for o in rows))


if __name__ == "__main__":
    import contextlib
    import io
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        main()
    text = buf.getvalue()
    print(text, end="")
    visit = sys.argv[sys.argv.index("--visit") + 1] if "--visit" in sys.argv else "G1"
    (HERE / "runs" / visit / "score.md").write_text(text, encoding="utf-8")
