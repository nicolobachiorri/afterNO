"""
Stability (see PROTOCOL.md, modifications 10 and 13): does the extension give the
same answer when the same site is visited again with the same version?

Compares two visits of the same sample, from the robot's results only (no judgment
needed): whether the robot could reject, whether the extension recorded the choice,
and the extension's conclusion where it gave one in both visits.

Usage (from the quality folder):
    python3 stability.py --first C1 --second C2     # writes runs/C2/stability.md
"""

import argparse
import csv
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
LABEL = {"verdictRespected": "sembra rispettato", "verdictPartly": "solo in parte", "": "nessuna"}


def wilson(k, n, z=1.96):
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return (c - h, c + h)


def pct(x):
    return "n/d" if x != x else f"{x:.0%}"


def load(visit):
    with open(HERE / "runs" / visit / "results.csv", encoding="utf-8") as f:
        return {int(r["order"]): r for r in csv.DictReader(f)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--first", required=True)
    ap.add_argument("--second", required=True)
    args = ap.parse_args()
    sample_file = HERE / ("sites_C.csv" if args.first.startswith("C") else "sites.csv")
    with open(sample_file, encoding="utf-8") as f:
        sample = {int(r["order"]): r["url"] for r in csv.DictReader(f) if r["role"].startswith("sample")}
    a, b = load(args.first), load(args.second)
    orders = [o for o in sorted(sample) if o in a and o in b]

    def compare(name, value, among=None):
        pool = [o for o in orders if among is None or among(o)]
        same = [o for o in pool if value(a[o]) == value(b[o])]
        lo, hi = wilson(len(same), len(pool))
        diff = [(o, value(a[o]), value(b[o])) for o in pool if value(a[o]) != value(b[o])]
        return {"question": name, "n": len(pool), "same": len(same),
                "share": len(same) / len(pool) if pool else None, "ci95": [lo, hi], "differences": diff}

    clicked = lambda r: r.get("reject_clicked") == "True"
    recorded = lambda r: bool(r.get("choice_recorded"))
    results = [
        compare("il robot ha cliccato un rifiuto", clicked),
        compare("l'estensione ha registrato la scelta (siti cliccati in entrambe)", recorded,
                lambda o: clicked(a[o]) and clicked(b[o])),
        compare("stessa conclusione (siti con una conclusione in entrambe)", lambda r: r.get("conclusion", ""),
                lambda o: bool(a[o].get("conclusion")) and bool(b[o].get("conclusion"))),
    ]

    lines = [f"# Stabilità: visita {args.first} contro visita {args.second}", "",
             "Calcolata da `stability.py` sui risultati del robot, senza giudizio. Stessa versione dell'estensione, "
             "stesso campione. Vedi il protocollo, modifica 13, sull'intervallo tra le due visite.", "",
             "| Domanda | Siti | Uguale nelle due visite | Intervallo 95% (Wilson) |", "| --- | --- | --- | --- |"]
    for r in results:
        lines.append(f"| {r['question']} | {r['n']} | {r['same']} ({pct(r['share'] if r['share'] is not None else float('nan'))}) "
                     f"| {pct(r['ci95'][0])}–{pct(r['ci95'][1])} |")
    lines.append("")
    for r in results:
        for o, x, y in r["differences"]:
            lines.append(f"- {r['question']}: sito {o} ({sample[o]}): {args.first} «{LABEL.get(x, x)}», "
                         f"{args.second} «{LABEL.get(y, y)}»")
    out = HERE / "runs" / args.second
    (out / "stability.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (out / "stability.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
