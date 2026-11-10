// Recomputes the verdict of every recorded rejection from the saved raw data (raw.json,
// verdict.json), with the extension's own code. Run by sensitivity.py, which copies
// extension/lib to a temporary folder with the two time thresholds made adjustable.
// Usage: node sensitivity_verdict.ts <quality folder> <visit>...
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { classifyCookie } from './lib/snapshot.ts';
import { buildVerdict } from './lib/verdict.ts';
import { siteOf } from './lib/hosts.ts';
const db = JSON.parse(readFileSync(process.env.COOKIE_DB!, 'utf8'));
const Q = process.argv[2];
const out: Record<string, string> = {};
for (const visit of process.argv.slice(3)) {
  const dir = `${Q}/runs/${visit}`;
  for (const d of readdirSync(dir)) {
    const v = `${dir}/${d}/verdict.json`, r = `${dir}/${d}/raw.json`;
    if (!existsSync(v) || !existsSync(r)) continue;
    const vj = JSON.parse(readFileSync(v, 'utf8')), raw = JSON.parse(readFileSync(r, 'utf8'));
    if (vj.choice?.choice !== 'rejected' || !vj.hostsConsidered) continue;
    const now = vj.choice.at;
    const pageSite = siteOf(vj.host);
    const conv = (c: any) => ({ name: c.name, domain: c.domain, partitionKey: c.partitionKey || undefined,
      sameSite: c.sameSite === 'None' ? 'no_restriction' : c.sameSite ? c.sameSite.toLowerCase() : 'unspecified',
      session: !!c.session || !(c.expires > 0), expirationDate: c.expires > 0 ? c.expires : undefined });
    const cookies = (raw.cookies || []).map(conv);
    const own = cookies.filter((c: any) => siteOf(c.domain.replace(/^\./, '')) === pageSite).map((c: any) => classifyCookie(c, db, false, now));
    const hosts = vj.hostsConsidered.filter((h: string) => siteOf(h) !== pageSite);
    const tr = cookies.filter((c: any) => { const dom = c.domain.replace(/^\./, '');
      return siteOf(dom) !== pageSite && hosts.some((h: string) => h === dom || h.endsWith('.' + dom)); })
      .map((c: any) => classifyCookie(c, db, true, now));
    const ver = buildVerdict(vj.choice, own, tr, now);
    out[`${visit}/${d}`] = `${ver.conclusion?.tone}|${vj.conclusion?.tone}`;
  }
}
console.log(JSON.stringify(out));
