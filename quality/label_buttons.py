"""
Mark the reject button of every site BEFORE the measurement, independently of the
extension (PROTOCOL.md, modification 38).

Until sample F the robot looked for "Reject" with the extension's own phrases
(robot_labels.py): a phrase the extension did not know was not clicked either, and the
site was filed as "nothing to check" instead of as an error. Here a person decides
which control is the free rejection, by looking at the banner.

Step 1, the robot (no extension installed): for each site of the sample it opens the
home page in a new profile, with the country's language, waits for the banner, and
saves a screenshot where every visible control is numbered, plus the list of those
controls (text, accessible name, frame).
    python3 label_buttons.py --sample G            # writes runs/G0/<site>/...
    python3 label_buttons.py --sample G --only 6512

Step 2, the person: open runs/G0/labels.html, and for every site pick the number of
the free reject control (the X counts when the banner's text says that closing keeps
the defaults, or in Italy), or say that there is none. Export labels_G.csv with the
button at the top and save it in runs/G0/. The person does not see the extension.

measure.py --visit G1 --labels runs/G0/labels_G.csv then clicks exactly that control,
with a real mouse click.
"""

import argparse
import csv
import html
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

HERE = Path(__file__).resolve().parent
FIRST_WAIT_S = 8
MAX_CANDIDATES = 80

# Every visible control in the viewport: buttons, links, elements with a button role,
# inputs, and the plain elements that look like an X (class or id with "close", or an
# accessible name only).
CANDIDATES_JS = r"""
() => {
  const sel = 'button, a, [role="button"], input[type="button"], input[type="submit"], [class*="close" i], [id*="close" i], [aria-label]';
  const out = [], seen = new Set();
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
    const text = ((el instanceof HTMLInputElement) ? el.value : (el.innerText || '')).replace(/\s+/g, ' ').trim();
    const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    const label = text || aria;
    if (label.length > 60) continue;
    const names = `${typeof el.className === 'string' ? el.className : ''} ${el.id}`;
    if (!label && !/close/i.test(names)) continue;
    const key = `${label}|${Math.round(r.x)},${Math.round(r.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Banner-like first: inside something fixed, sticky or modal, or a short container
    // that talks about cookies or consent. Only for the order of the list: every
    // visible control is still listed.
    let overlay = false, consent = false;
    for (let a = el.parentElement, i = 0; a && i < 15; a = a.parentElement, i++) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed' || cs.position === 'sticky' || a.getAttribute('role') === 'dialog' || a.getAttribute('aria-modal') === 'true') overlay = true;
      const t = a.textContent || '';
      if (!consent && t.length < 3000 && /cookie|consent|consens|privacy|datenschutz|einwilligung|donn[ée]es|confidentialit|privacidad|privacidade|toestemming|prywatno|zgod/i.test(t)) consent = true;
    }
    out.push({ tag: el.tagName.toLowerCase(), text, aria, names: names.trim().slice(0, 100),
               x: r.x, y: r.y, w: r.width, h: r.height, score: (consent ? 3 : 0) + (overlay ? 2 : 0) });
  }
  return out;
}
"""

OVERLAY_JS = r"""
(boxes) => {
  const layer = document.createElement('div');
  layer.id = '__label_overlay';
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  for (const b of boxes) {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;outline:2px solid #e8173a;`;
    const n = document.createElement('span');
    n.textContent = b.n;
    n.style.cssText = 'position:absolute;left:-2px;top:-18px;background:#e8173a;color:#fff;font:bold 12px/16px sans-serif;padding:0 4px;border-radius:3px';
    d.appendChild(n);
    layer.appendChild(d);
  }
  document.documentElement.appendChild(layer);
}
"""


def sample_rows(letter, only):
    with open(HERE / f"sites_{letter}.csv", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["role"] == "sample"]
    if only:
        wanted = {x.strip() for x in only.split(",")}
        rows = [r for r in rows if r["order"] in wanted]
    return rows


def label_site(p, row, folder, headless):
    folder.mkdir(parents=True, exist_ok=True)
    profile = tempfile.mkdtemp(prefix="cookie-label-")
    info = {"order": row["order"], "url": row["url"], "candidates": []}
    try:
        context = p.chromium.launch_persistent_context(
            profile, channel="chromium", headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
            locale=row.get("locale") or "it-IT", timezone_id=row.get("timezone") or "Europe/Rome",
            viewport={"width": 1366, "height": 900})
        context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        context.set_default_timeout(5000)
        page = context.pages[0] if context.pages else context.new_page()
        try:
            page.goto(row["url"], wait_until="domcontentloaded", timeout=45000)
        except PWTimeout:
            info["error"] = "timeout on load"
        page.wait_for_timeout(FIRST_WAIT_S * 1000)
        info["final_url"] = page.url
        for frame in page.frames:
            try:
                found = frame.evaluate(CANDIDATES_JS)
            except Exception:
                continue
            ox = oy = 0
            if frame != page.main_frame:
                try:
                    box = frame.frame_element().bounding_box()
                except Exception:
                    box = None
                if not box:
                    continue
                ox, oy = box["x"], box["y"]
            for c in found:
                # a control inside an iframe is often the banner of a consent platform
                info["candidates"].append({**c, "score": c.get("score", 0) + (0 if frame == page.main_frame else 2),
                                           "x": c["x"] + ox, "y": c["y"] + oy,
                                           "frame_url": frame.url[:300],
                                           "frame": "main" if frame == page.main_frame else urlparse(frame.url).hostname})
        # Banner-like controls first (stable sort), then numbered.
        info["candidates"] = sorted(info["candidates"], key=lambda c: -c["score"])[:MAX_CANDIDATES]
        for i, c in enumerate(info["candidates"], 1):
            c["n"] = i
        try:
            page.evaluate(OVERLAY_JS, [{k: c[k] for k in ("x", "y", "w", "h", "n")} for c in info["candidates"]])
        except Exception:
            pass
        page.screenshot(path=str(folder / "labels.png"))
        context.close()
    except Exception as e:
        info["error"] = str(e)[:200]
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    (folder / "candidates.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
    return info


PAGE = """<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Pulsanti di rifiuto, campione {letter}</title>
<style>
body {{ font:14px/1.45 system-ui, sans-serif; margin:0 16px 80px; background:#fff; color:#1d1d1f; }}
header {{ position:sticky; top:0; background:#fff; border-bottom:1px solid #ddd; padding:10px 0; z-index:2; }}
.site {{ border:1px solid #ddd; border-radius:10px; padding:12px 16px; margin:18px 0; }}
.site.done {{ outline:2px solid #3a8f3a; }} img {{ max-width:100%; border:1px solid #ddd; }}
table {{ border-collapse:collapse; font-size:12px; }} td {{ border-bottom:1px solid #eee; padding:2px 6px; }}
label {{ margin-right:14px; white-space:nowrap; }}
</style></head><body>
<header><b>Pulsanti di rifiuto, campione {letter}</b> · {n} siti · <span id="progress"></span>
 · <button id="export">Esporta labels_{letter}.csv</button></header>
<p>Per ogni sito scegli il numero del controllo che <b>rifiuta gratuitamente</b> (tutto il non necessario, al primo livello).
La X conta solo se il testo del banner dice che chiudere mantiene le impostazioni predefinite, o se il sito è italiano.
Se il rifiuto c'è solo al secondo livello, o solo a pagamento, o non c'è banner, dillo. Non guardare l'estensione.</p>
{cards}
<script>
const KEY = 'cookie-labels-{letter}';
let data = {{}}; try {{ data = JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch (e) {{}}
const save = () => {{ try {{ localStorage.setItem(KEY, JSON.stringify(data)); }} catch (e) {{}} }};
function restore() {{ for (const [k, v] of Object.entries(data)) document.querySelectorAll(`[name="${{k}}"]`).forEach((el) => {{ if (el.type === 'radio') el.checked = el.value === v; else el.value = v; }}); }}
function progress() {{ let d = 0; document.querySelectorAll('.site').forEach((s) => {{ const ok = !!data['s' + s.dataset.order]; s.classList.toggle('done', ok); d += ok; }}); document.getElementById('progress').textContent = d + ' fatti'; }}
document.addEventListener('input', (e) => {{ if (!e.target.name) return; data[e.target.name] = e.target.value; save(); progress(); }});
document.getElementById('export').addEventListener('click', () => {{
  const rows = [['order', 'answer', 'n', 'tag', 'text', 'aria', 'frame_url', 'notes']];
  document.querySelectorAll('.site').forEach((s) => {{
    const o = s.dataset.order, a = data['s' + o] || '', c = (JSON.parse(s.dataset.cands))[a] || null;
    rows.push([o, c ? 'control' : a, c ? a : '', c ? c.tag : '', c ? c.text : '', c ? c.aria : '', c ? c.frame_url : '', data['n' + o] || '']);
  }});
  const csv = rows.map((r) => r.map((x) => `"${{String(x).replaceAll('"', '""')}}"`).join(',')).join('\\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {{ type: 'text/csv' }}));
  a.download = 'labels_{letter}.csv'; a.click();
}});
restore(); progress();
</script></body></html>"""


def card(info, rel):
    o = info["order"]
    cands = {str(c["n"]): {"tag": c["tag"], "text": c["text"], "aria": c["aria"], "frame_url": c["frame_url"]}
             for c in info["candidates"]}
    rows = "".join(f"<tr><td><label><input type='radio' name='s{o}' value='{c['n']}'> {c['n']}</label></td>"
                   f"<td>{html.escape(c['text'] or '')}</td><td>{html.escape(c['aria'] or '')}</td>"
                   f"<td>{html.escape(c['tag'])}</td><td>{html.escape(c['frame'] or '')}</td></tr>"
                   for c in info["candidates"])
    none = "".join(f"<label><input type='radio' name='s{o}' value='{v}'> {t}</label>" for v, t in [
        ("no_banner", "nessun banner"), ("no_free_reject", "nessun rifiuto gratuito al primo livello"),
        ("second_layer", "rifiuto solo al secondo livello"), ("blocked", "pagina vuota o robot bloccato"),
        ("unsure", "non so")])
    return (f"<section class='site' data-order='{o}' data-cands='{html.escape(json.dumps(cands, ensure_ascii=False))}'>"
            f"<h2>{o}. {html.escape(info['url'])}</h2>"
            f"<p>{html.escape(info.get('error', ''))}</p>"
            f"<a href='{rel}/labels.png' target='_blank'><img src='{rel}/labels.png' alt='banner'></a>"
            f"<p>{none}</p><table>{rows}</table>"
            f"<p>Note <input name='n{o}' size='60'></p></section>")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", default="G")
    ap.add_argument("--only")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--page-only", action="store_true", help="rebuild labels.html from the saved files")
    args = ap.parse_args()
    run = HERE / "runs" / f"{args.sample}0"
    rows = sample_rows(args.sample, args.only)
    if not args.page_only:
        with sync_playwright() as p:
            for i, row in enumerate(rows, 1):
                folder = run / f"{int(row['order']):02d}_{urlparse(row['url']).hostname.removeprefix('www.')}"
                print(f"[{i}/{len(rows)}] {row['order']} {row['url']}")
                info = label_site(p, row, folder, args.headless)
                print("     ", len(info["candidates"]), "controls", info.get("error", ""))
    cards = []
    for row in sample_rows(args.sample, None):
        folders = list(run.glob(f"{int(row['order']):02d}_*"))
        if folders and (folders[0] / "candidates.json").exists():
            info = json.loads((folders[0] / "candidates.json").read_text(encoding="utf-8"))
            cards.append(card(info, folders[0].name))
    (run / "labels.html").write_text(PAGE.format(letter=args.sample, n=len(cards), cards="".join(cards)), encoding="utf-8")
    print(f"{len(cards)} sites -> {run / 'labels.html'}")


if __name__ == "__main__":
    main()
