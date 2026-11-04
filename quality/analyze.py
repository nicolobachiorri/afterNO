"""
Results of one visit (see PROTOCOL.md, "Misure"), computed from the files only, so
that anyone can recompute them.

Inputs, in runs/<visit>/:
  judgments_<visit>_<primary>.csv   the judgment the results are based on
  judgments_<visit>_<second>.csv    a second judgment, for the agreement
  results.csv                       what the robot did (for the reasons)
Output: runs/<visit>/summary.md and summary.json

Usage (from the quality folder):
    python3 analyze.py --visit A --primary claude --second gemini
"""

import argparse
import csv
import json
import math
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent

CONCLUSIONS = {
    "correct": "corretta",
    "debatable": "discutibile",
    "false_alarm": "sbagliata: falso allarme",
    "missed": "sbagliata: problema non visto",
    "not_recorded": "errore: scelta non registrata",
}
MEASURABLE = {
    "si": "misurabile", "no_banner": "nessun banner", "no_reject": "banner senza rifiuto",
    "no_click": "clic non riuscito", "no_blocked": "robot bloccato", "other": "altro",
}
ITEMS = {"ok": "tutti corretti", "imprecise": "almeno uno impreciso", "wrong": "almeno uno sbagliato"}


def wilson(k, n, z=1.96):
    """95% Wilson interval for a proportion k/n: better than p ± 1.96·se for small n."""
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return (centre - half, centre + half)


def cohen_kappa(a, b):
    """Observed agreement and Cohen's kappa for two lists of labels."""
    n = len(a)
    if n == 0:
        return (float("nan"), float("nan"))
    po = sum(x == y for x, y in zip(a, b)) / n
    pe = sum((a.count(c) / n) * (b.count(c) / n) for c in set(a) | set(b))
    return (po, (po - pe) / (1 - pe) if pe < 1 else 1.0)


def load(path):
    with open(path, encoding="utf-8") as f:
        return {int(r["order"]): r for r in csv.DictReader(f)}


def pct(x):
    return "n/d" if x != x else f"{x:.0%}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--visit", required=True)
    ap.add_argument("--primary", required=True, help="judge whose judgment gives the results")
    ap.add_argument("--second", help="second judge, for the agreement")
    args = ap.parse_args()
    run = HERE / "runs" / args.visit

    # Visits A and B use sample A/B; visits C1, C2... use sample C.
    with open(HERE / (f"sites_{args.visit[0]}.csv" if args.visit[0] in "CDE" else "sites.csv"), encoding="utf-8") as f:
        sample = {int(r["order"]): r["url"] for r in csv.DictReader(f) if r["role"].startswith("sample")}
    primary = load(run / f"judgments_{args.visit}_{args.primary}.csv")
    orders = sorted(sample)
    missing = [o for o in orders if o not in primary]
    if missing:
        raise SystemExit(f"Sites of the sample without a judgment: {missing}")

    measurable = [o for o in orders if primary[o]["measurable"] == "si"]
    n = len(measurable)
    concl = Counter(primary[o]["conclusion"] for o in measurable)
    reasons = Counter(primary[o]["measurable"] for o in orders if o not in measurable)
    with_choice = [o for o in measurable if primary[o]["conclusion"] != "not_recorded"]
    items = Counter(primary[o]["items"] for o in with_choice)

    out = {"visit": args.visit, "primary_judge": args.primary, "sites": len(orders),
           "measurable": n, "not_measurable": dict(reasons), "conclusions": {}, "items": dict(items)}
    lines = [f"# Visita {args.visit}: risultati", "",
             f"Giudice principale: **{args.primary}**. Calcolato da `analyze.py` sui file di questa cartella.", "",
             f"Siti nel campione: {len(orders)}. Misurabili: **{n}**.", "",
             "Non misurabili, per motivo: " + ", ".join(f"{MEASURABLE.get(k, k)} {v}" for k, v in reasons.most_common()) + ".", "",
             "## Conclusioni (siti misurabili)", "",
             "| Conclusione | Siti | Quota | Intervallo 95% (Wilson) |", "| --- | --- | --- | --- |"]
    for key, label in CONCLUSIONS.items():
        k = concl.get(key, 0)
        lo, hi = wilson(k, n)
        out["conclusions"][key] = {"n": k, "share": k / n if n else None, "ci95": [lo, hi]}
        lines.append(f"| {label} | {k} | {pct(k / n if n else float('nan'))} | {pct(lo)}–{pct(hi)} |")
    lines += ["", f"Punti della lista, nei {len(with_choice)} siti in cui la scelta è stata registrata: "
              + ", ".join(f"{ITEMS.get(k, k)} {v}" for k, v in items.most_common()) + "."]

    if args.second:
        second = load(run / f"judgments_{args.visit}_{args.second}.csv")
        meas = lambda d, o: "si" if d.get(o, {}).get("measurable") == "si" else "no"
        a = [meas(primary, o) for o in orders]
        b = [meas(second, o) for o in orders]
        po_m, k_m = cohen_kappa(a, b)
        both = [o for o, x, y in zip(orders, a, b) if x == y == "si"]
        ca = [primary[o]["conclusion"] for o in both]
        cb = [second[o]["conclusion"] for o in both]
        po_c, k_c = cohen_kappa(ca, cb)
        dis_m = [o for o, x, y in zip(orders, a, b) if x != y]
        dis_c = [(o, primary[o]["conclusion"], second[o]["conclusion"]) for o in both
                 if primary[o]["conclusion"] != second[o]["conclusion"]]
        out["agreement"] = {"second_judge": args.second,
                            "measurable": {"observed": po_m, "kappa": k_m, "n": len(orders), "disagreements": dis_m},
                            "conclusion": {"observed": po_c, "kappa": k_c, "n": len(both),
                                           "disagreements": [list(d) for d in dis_c]}}
        lines += ["", f"## Accordo con il secondo giudice ({args.second})", "",
                  "| Domanda | Siti | Accordo osservato | Kappa di Cohen |", "| --- | --- | --- | --- |",
                  f"| Misurabile sì/no | {len(orders)} | {pct(po_m)} | {k_m:.2f} |",
                  f"| Conclusione (siti misurabili per entrambi) | {len(both)} | {pct(po_c)} | {k_c:.2f} |", ""]
        if dis_m:
            lines.append("Disaccordi sulla misurabilità: siti " + ", ".join(map(str, dis_m)) + ".")
        for o, x, y in dis_c:
            lines.append(f"- sito {o} ({sample[o]}): {args.primary} «{CONCLUSIONS.get(x, x)}», "
                         f"{args.second} «{CONCLUSIONS.get(y, y)}»")

    (run / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (run / "summary.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
