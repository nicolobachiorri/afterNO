// First party or third party? Two hosts belong to the same "site" when they share
// the registrable domain: www.ilmeteo.it and static.ilmeteo.it are both ilmeteo.it.
//
// The exact rule needs the Public Suffix List (what tldextract used in step 1).
// Here we use an approximation that is right for .it, .com and most domains, plus a
// short list of two-label suffixes such as co.uk. It is only used to decide which
// hosts the page contacted are "other sites"; a mistake makes us look at the cookies
// of one host too many or too few, it never changes how a cookie is classified.

const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au',
  'co.jp', 'ne.jp', 'or.jp', 'com.br', 'co.nz', 'co.in', 'com.mx',
  'com.tr', 'com.cn', 'co.za', 'com.ar', 'co.kr',
]);

export function siteOf(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, '');
  // IP addresses, IPv6 literals and single-label names (localhost) are their own site.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.startsWith('[') || !h.includes('.')) return h;
  const labels = h.split('.');
  const lastTwo = labels.slice(-2).join('.');
  if (TWO_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3) return labels.slice(-3).join('.');
  return lastTwo;
}

export function isThirdParty(host: string, pageHost: string): boolean {
  return siteOf(host) !== siteOf(pageHost);
}
