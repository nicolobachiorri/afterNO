"""
Build the page the judge uses for one visit (see PROTOCOL.md, "Giudizio").

For every site of the sample it shows, side by side: the screenshots, the extension's
verdict (in Italian, as the user reads it) and the raw data collected by the robot,
plus the questions of the protocol. Answers are kept in the browser while you work
and exported as judgments_<visit>.csv with the button at the top.

The raw-data table marks the cookies that meet the protocol's "problem not seen"
criteria mechanically (third party, contacted after the click, readable by other
sites, not partitioned, valid at least 30 days, marketing or unknown in the
database). It is an aid: the judge decides.

Usage (from the quality folder):
    python3 build_review.py --visit A      # writes runs/A/review.html
"""

import argparse
import csv
import html
import json
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MESSAGES = ROOT / "extension" / "public" / "_locales" / "it" / "messages.json"
COOKIE_DB = ROOT / "extension" / "public" / "cookie-db.json"
DAY = 86400


def site_of(host):
    host = (host or "").lstrip(".").lower()
    return ".".join(host.split(".")[-2:])


def message(msgs, key, count=None, subs=()):
    """Render a message as the popup does: plural form, then $NAME$ placeholders."""
    if count is not None:
        key = f"{key}_one" if count == 1 else f"{key}_other"
    m = msgs.get(key)
    if not m:
        return key
    args = ([count] if count is not None else []) + list(subs or [])
    text = m["message"]
    for name, ph in (m.get("placeholders") or {}).items():
        i = int(ph["content"][1:]) - 1
        text = text.replace(f"${name.upper()}$", str(args[i]) if i < len(args) else "")
    return text


def db_lookup(db, name):
    """The database entry for a cookie name, by the plain name rule (no domain rule):
    the judge sees what the database says and decides whether it fits."""
    if name in db["exact"]:
        e = db["exact"][name]
        return e[0], e[1], (e[2] if len(e) > 2 else [])
    for p in db["prefixes"]:
        if name.startswith(p[0]):
            return p[1], p[2], (p[3] if len(p) > 3 else [])
    return "Unknown", "", []


def raw_rows(raw, db, now):
    home = site_of(raw.get("final_url", "").split("/")[2] if "://" in raw.get("final_url", "") else "")
    after_sites = {site_of(h) for h in raw.get("third_party_hosts_after_click", [])}
    third, own = [], []
    for c in raw.get("cookies", []):
        if "name" not in c:
            continue
        cat, platform, owners = db_lookup(db, c["name"])
        days = None if c.get("session") or not c.get("expires") or c["expires"] < 0 else round((c["expires"] - now) / DAY)
        row = {
            "name": c["name"], "domain": c["domain"], "sameSite": c.get("sameSite") or "-",
            "days": "sessione" if days is None else days,
            "partitioned": bool(c.get("partitionKey")),
            "cat": cat, "platform": platform, "owners": ", ".join(owners),
        }
        if site_of(c["domain"]) == home:
            own.append(row)
            continue
        row["contacted_after"] = site_of(c["domain"]) in after_sites
        row["criteria"] = (row["contacted_after"] and row["sameSite"] == "None" and not row["partitioned"]
                           and isinstance(days, int) and days >= 30 and cat in ("Marketing", "Unknown"))
        third.append(row)
    third.sort(key=lambda r: (not r["criteria"], r["domain"], r["name"]))
    own.sort(key=lambda r: (r["cat"] not in ("Marketing", "Analytics"), r["name"]))
    return third, own


def esc(x):
    return html.escape(str(x))


def site_card(order, row, folder, msgs, db, now):
    vpath, rpath = folder / "verdict.json", folder / "raw.json"
    verdict = json.loads(vpath.read_text(encoding="utf-8")) if vpath.exists() else {"error": "no verdict.json"}
    raw = json.loads(rpath.read_text(encoding="utf-8")) if rpath.exists() else {}
    rel = folder.name

    items_html = ""
    for it in verdict.get("items", []):
        text = message(msgs, it["key"], it.get("count"), it.get("subs"))
        names = ", ".join(it.get("names") or [])
        mark = {"ok": "✓", "bad": "✗", "info": "ℹ"}[it["mark"]]
        items_html += f"<li class='{it['mark']}'><b>{mark}</b> {esc(text)} {esc(names)}</li>"
    concl = verdict.get("conclusion") or {}
    choice = verdict.get("choice")
    choice_txt = (f"{choice['choice']} (fonte: {choice['source']}"
                  + (f", pulsante «{esc(choice.get('label', ''))}»" if choice.get("label") else "") + ")") \
        if choice else "<b class='warn'>nessuna scelta registrata dall'estensione</b>"

    third, own = raw_rows(raw, db, now) if raw else ([], [])
    def table(rows, with_criteria):
        if not rows:
            return "<p class='muted'>Nessuno.</p>"
        head = "<tr><th>cookie</th><th>dominio</th><th>SameSite</th><th>giorni</th><th>part.</th><th>categoria DB</th><th>piattaforma DB (domini)</th>" \
               + ("<th>contattato dopo il clic</th><th>criteri «non visto»</th>" if with_criteria else "") + "</tr>"
        body = ""
        for r in rows:
            body += (f"<tr class='{'crit' if r.get('criteria') else ''}'><td><code>{esc(r['name'])}</code></td><td>{esc(r['domain'])}</td>"
                     f"<td>{esc(r['sameSite'])}</td><td>{esc(r['days'])}</td><td>{'sì' if r['partitioned'] else ''}</td>"
                     f"<td>{esc(r['cat'])}</td><td>{esc(r['platform'])}{(' (' + esc(r['owners']) + ')') if r['owners'] else ''}</td>")
            if with_criteria:
                body += f"<td>{'sì' if r['contacted_after'] else ''}</td><td>{'✔' if r['criteria'] else ''}</td>"
            body += "</tr>"
        return f"<table>{head}{body}</table>"

    tcf = raw.get("tcf")
    tcf_txt = "assente" if not tcf else esc(json.dumps(tcf, ensure_ascii=False))
    q = f"q{order}"
    radios = lambda name, opts: "".join(
        f"<label><input type='radio' name='{q}_{name}' value='{v}'> {t}</label>" for v, t in opts)

    return f"""
<section class="site" id="s{order}" data-order="{order}">
  <h2>{order}. {esc(row['url'])} <small>({esc(row['source'])})</small></h2>
  <p class="meta">Pagina finale: {esc(raw.get('final_url', '-'))} · banner (robot): <b>{esc(row.get('banner_type', '-'))}</b>
   · clic: {esc(row.get('reject_how', '-'))}<br>Pulsanti visti: {esc(row.get('visible_buttons', ''))}</p>
  <div class="cols">
    <div class="shots">
      <a href="{rel}/page.png" target="_blank"><img src="{rel}/page.png" alt="pagina dopo il rifiuto e il ricaricamento"></a>
      <a href="{rel}/popup.png" target="_blank"><img src="{rel}/popup.png" alt="popup dell'estensione"></a>
    </div>
    <div class="facts">
      <h3>Verdetto dell'estensione</h3>
      <p>Scelta: {choice_txt}</p>
      <ul class="items">{items_html or "<li class='muted'>nessun punto</li>"}</ul>
      <p>Conclusione: <b>{esc(message(msgs, concl['key']) if concl else '— nessuna')}</b>
       {('<br><span class=warn>Errore: ' + esc(verdict['error']) + '</span>') if verdict.get('error') else ''}</p>
      <h3>Dati grezzi (robot)</h3>
      <p>TCF: {tcf_txt}<br>Clic al secondo {esc(raw.get('click_at_s', '-'))}, ricaricamento al {esc(raw.get('reload_at_s', '-'))}.
       Siti terzi contattati dopo il clic: {len(raw.get('third_party_hosts_after_click', []))}.</p>
      <details open><summary>Cookie di siti terzi ({len(third)}; in evidenza quelli che soddisfano i criteri)</summary>{table(third, True)}</details>
      <details><summary>Cookie del sito ({len(own)})</summary>{table(own, False)}</details>
    </div>
  </div>
  <div class="form">
    <p><b>1. Misurabile?</b> {radios('measurable', [('si', 'sì'), ('no_banner', 'no: nessun banner'), ('no_reject', 'no: banner senza rifiuto'), ('no_click', 'no: il clic non ha chiuso il banner'), ('no_blocked', 'no: robot bloccato'), ('other', 'altro')])}</p>
    <p><b>2. Punti della lista</b> {radios('items', [('ok', 'tutti corretti'), ('imprecise', 'almeno uno impreciso'), ('wrong', 'almeno uno sbagliato')])}</p>
    <p><b>3. Etichette errate tra i cookie nominati</b> <input type="number" min="0" name="{q}_labels" style="width:4em"></p>
    <p><b>4. Conclusione</b> {radios('conclusion', [('correct', 'corretta'), ('debatable', 'discutibile'), ('false_alarm', 'sbagliata: falso allarme'), ('missed', 'sbagliata: problema non visto'), ('not_recorded', 'errore: scelta non registrata')])}</p>
    <p><b>Note</b><br><textarea name="{q}_notes" rows="2"></textarea></p>
  </div>
</section>"""


PAGE = """<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Giudizio visita {visit}</title>
<style>
:root {{ --bg:#fff; --fg:#1d1d1f; --muted:#6b6b6b; --line:#ddd; --crit:#fdecea; --warn:#b3261e; --card:#fafafa; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#1c1c1e; --fg:#eee; --muted:#9a9a9a; --line:#3a3a3a; --crit:#4a2422; --warn:#ff8a80; --card:#242426; }} }}
body {{ background:var(--bg); color:var(--fg); font:14px/1.45 system-ui, sans-serif; margin:0 16px 80px; }}
header {{ position:sticky; top:0; background:var(--bg); border-bottom:1px solid var(--line); padding:10px 0; z-index:2; }}
.site {{ border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin:18px 0; background:var(--card); }}
.site h2 {{ font-size:17px; margin:0 0 4px; }} .meta, .muted {{ color:var(--muted); }}
.cols {{ display:flex; gap:16px; flex-wrap:wrap; }} .shots {{ flex:0 0 340px; display:flex; flex-direction:column; gap:8px; }}
.shots img {{ width:100%; border:1px solid var(--line); border-radius:6px; }} .facts {{ flex:1 1 480px; min-width:0; }}
table {{ border-collapse:collapse; font-size:12px; width:100%; }} td, th {{ border-bottom:1px solid var(--line); padding:3px 5px; text-align:left; vertical-align:top; }}
tr.crit {{ background:var(--crit); }} code {{ word-break:break-all; }} .warn {{ color:var(--warn); }}
.items li.bad b {{ color:var(--warn); }} .form {{ border-top:1px solid var(--line); margin-top:10px; padding-top:6px; }}
.form label {{ margin-right:12px; white-space:nowrap; }} textarea {{ width:100%; }}
.done {{ outline:2px solid #3a8f3a; }}
</style></head><body>
<header><b>Giudizio, visita {visit}</b> · {n} siti · <span id="progress"></span>
 · <button id="export">Esporta judgments_{visit}.csv</button>
 <span class="muted">Le risposte restano in questo browser finché non esporti.</span></header>
<p class="muted">Regole: quality/PROTOCOL.md, sezione «Giudizio». Generato il {when}.</p>
{cards}
<script>
const KEY = 'cookie-review-{visit}';
const load = () => {{ try {{ return JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch (e) {{ return {{}}; }} }};
const save = (d) => {{ try {{ localStorage.setItem(KEY, JSON.stringify(d)); }} catch (e) {{}} }};
let data = load();
const fields = ['measurable', 'items', 'labels', 'conclusion', 'notes'];
function restore() {{
  for (const [name, value] of Object.entries(data)) {{
    document.querySelectorAll(`[name="${{name}}"]`).forEach((el) => {{
      if (el.type === 'radio') el.checked = el.value === value; else el.value = value;
    }});
  }}
}}
function progress() {{
  let done = 0;
  document.querySelectorAll('.site').forEach((s) => {{
    const o = s.dataset.order, m = data[`q${{o}}_measurable`];
    const complete = m && (m !== 'si' || data[`q${{o}}_conclusion`]);
    s.classList.toggle('done', !!complete); if (complete) done++;
  }});
  document.getElementById('progress').textContent = `${{done}} giudicati`;
}}
document.addEventListener('input', (e) => {{
  if (!e.target.name) return;
  data[e.target.name] = e.target.value; save(data); progress();
}});
document.getElementById('export').addEventListener('click', () => {{
  const rows = [['visit', 'order', ...fields]];
  document.querySelectorAll('.site').forEach((s) => {{
    const o = s.dataset.order;
    rows.push(['{visit}', o, ...fields.map((f) => data[`q${{o}}_${{f}}`] ?? '')]);
  }});
  const csv = rows.map((r) => r.map((x) => `"${{String(x).replaceAll('"', '""')}}"`).join(',')).join('\\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {{ type: 'text/csv' }}));
  a.download = 'judgments_{visit}.csv'; a.click();
}});
restore(); progress();
</script></body></html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--visit", required=True)
    args = ap.parse_args()
    run_dir = HERE / "runs" / args.visit
    msgs = json.loads(MESSAGES.read_text(encoding="utf-8"))
    db = json.loads(COOKIE_DB.read_text(encoding="utf-8"))
    with open(HERE / "sites.csv", encoding="utf-8") as f:
        sample = {r["order"]: r for r in csv.DictReader(f) if r["role"].startswith("sample")}
    with open(run_dir / "results.csv", encoding="utf-8") as f:
        results = {r["order"]: r for r in csv.DictReader(f)}
    now = time.time()
    cards = []
    for order in sorted(sample, key=int):
        row = {**sample[order], **results.get(order, {})}
        folders = list(run_dir.glob(f"{int(order):02d}_*"))
        if not folders or order not in results:
            cards.append(f"<section class='site' data-order='{order}'><h2>{order}. {esc(row['url'])}</h2>"
                         f"<p class='warn'>Non ancora misurato in questa visita.</p></section>")
            continue
        cards.append(site_card(order, row, folders[0], msgs, db, now))
    out = run_dir / "review.html"
    out.write_text(PAGE.format(visit=args.visit, n=len(sample), when=time.strftime("%d/%m/%Y %H:%M"),
                               cards="".join(cards)), encoding="utf-8")
    print(f"{len(sample)} sites -> {out}")


if __name__ == "__main__":
    main()
