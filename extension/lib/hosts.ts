// First party or third party? Two hosts belong to the same "site" when they share
// the registrable domain: www.ilmeteo.it and static.ilmeteo.it are both ilmeteo.it.
//
// The exact rule needs the Public Suffix List (what tldextract used in step 1).
// Here we use an approximation that is right for .it, .com and most domains, plus a
// short list of two-label suffixes such as co.uk. It is only used to decide which
// hosts the page contacted are "other sites"; a mistake makes us look at the cookies
// of one host too many or too few, it never changes how a cookie is classified.

// Italian provinces: in the Public Suffix List, "bo.it" is a suffix like "co.uk", so
// aosp.bo.it and comune.bo.it are different sites (measurement, visit D1).
const IT_PROVINCES = (
  'ag al an ao ap aq ar at av ba bg bi bl bn bo br bs bt bz ca cb ce ch ci cl cn co cr cs ct cz ' +
  'en fc fe fg fi fm fr ge go gr im is kr lc le li lo lt lu mb mc me mi mn mo ms mt na no nu og ' +
  'or ot pa pc pd pe pg pi pn po pr pt pu pv pz ra rc re rg ri rm rn ro sa si so sp sr ss su sv ' +
  'ta te tn to tp tr ts tv ud va vb vc ve vi vr vs vt vv'
).split(' ').map((p) => `${p}.it`);

const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au',
  'co.jp', 'ne.jp', 'or.jp', 'com.br', 'co.nz', 'co.in', 'com.mx',
  'com.tr', 'com.cn', 'co.za', 'com.ar', 'co.kr',
  // Public administrations and schools in Italy: without these, cultura.gov.it,
  // mit.gov.it and pagopa.gov.it were all one site, "gov.it" (visit D1, site 102).
  'gov.it', 'edu.it', ...IT_PROVINCES,
  // Other European public administrations and common two-label suffixes.
  'gouv.fr', 'com.es', 'org.es', 'gob.es', 'co.at', 'or.at', 'gv.at',
  // Austrian universities: meduniwien.ac.at was stored as site "ac.at" (sample E).
  'ac.at', 'edu.pl', 'edu.es', 'edu.pt',
  'com.pl', 'net.pl', 'org.pl', 'gov.pl', 'com.pt', 'gov.pt', 'com.gr', 'gov.gr', 'com.cy',
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
