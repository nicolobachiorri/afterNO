// First party or third party? Two hosts belong to the same "site" when they share
// the registrable domain: www.ilmeteo.it and static.ilmeteo.it are both ilmeteo.it.
//
// The registrable domain is defined by the Public Suffix List, the same list browsers
// use for SameSite cookies and for partitioning: "co.uk", "bo.it" and also "github.io"
// are suffixes, so alice.github.io and bob.github.io are two different sites.
// Until 10 November 2026 this file used a hand-made approximation, which merged sites
// on github.io, blogspot.com or cloudfront.net (external review). The list is bundled
// (lib/psl-data.ts, rebuilt with tools/build_psl.py): no request leaves the browser.
import { PSL_RULES } from './psl-data.ts';

const RULES = new Set<string>();
const WILDCARDS = new Set<string>(); // "*.ck" is stored as "ck"
const EXCEPTIONS = new Set<string>(); // "!www.ck" is stored as "www.ck"
for (const rule of PSL_RULES.split('\n')) {
  if (rule.startsWith('!')) EXCEPTIONS.add(rule.slice(1));
  else if (rule.startsWith('*.')) WILDCARDS.add(rule.slice(2));
  else if (rule) RULES.add(rule);
}

// The public suffix of a host, following the list's algorithm: the longest matching
// rule wins, an exception rule cuts its leftmost label, no match means the last label.
function publicSuffixLength(labels: string[]): number {
  for (let i = 0; i < labels.length; i++) {
    const name = labels.slice(i).join('.');
    if (EXCEPTIONS.has(name)) return labels.length - i - 1;
    if (RULES.has(name)) return labels.length - i;
    if (i + 1 < labels.length && WILDCARDS.has(labels.slice(i + 1).join('.'))) return labels.length - i;
  }
  return 1;
}

export function siteOf(host: string): string {
  const h = host.toLowerCase().replace(/^\./, '').replace(/\.$/, '');
  // IP addresses, IPv6 literals and single-label names (localhost) are their own site.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.startsWith('[') || !h.includes('.')) return h;
  const labels = h.split('.');
  const suffix = publicSuffixLength(labels);
  // A host that is itself a public suffix (github.io) is its own site.
  if (suffix >= labels.length) return h;
  return labels.slice(-(suffix + 1)).join('.');
}

export function isThirdParty(host: string, pageHost: string): boolean {
  return siteOf(host) !== siteOf(pageHost);
}
