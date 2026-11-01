// Which tracker cookies matter for the page that is open?
//
// When a page contacts a tracker (say criteo.com), the browser attaches to that
// request the cookies stored for criteo.com, but only those marked SameSite=None
// ("no_restriction" in the extension API). Lax, Strict and unspecified cookies are
// not sent in a third-party context, so the tracker cannot read them from here.
//
// The result answers: "which cookies can the trackers on this page read?". A cookie
// may have been stored while visiting another site: the cookie jar is shared, and
// that is exactly how a tracker recognises the same person across sites.

export interface CookieLike {
  name: string;
  domain: string;
  path: string;
  sameSite?: string;
  // Set on a partitioned cookie: one kept in a separate jar for each top-level site
  // (Firefox's Total Cookie Protection, Chrome's CHIPS). It is sent to the tracker only
  // on that site, so it can recognise a returning visitor there, not across sites.
  partitionKey?: unknown;
}

export interface ThirdPartyCookie<T extends CookieLike> {
  cookie: T;
  hosts: string[]; // the contacted hosts this cookie is sent to, sorted
}

// Would the browser send this cookie to this host? Domain only: the path is left out
// on purpose. A tracker often keeps its identifier under a path of its own
// (/~dl, /769396664005295...), and we record the hosts a page contacts, not the paths:
// a cookie its tracker stored under a path is one it reads when it calls that path.
export function domainMatches(c: { domain: string; hostOnly?: boolean }, host: string): boolean {
  const d = c.domain.replace(/^\./, '').toLowerCase();
  const h = host.toLowerCase();
  if (c.hostOnly) return h === d;
  return h === d || h.endsWith(`.${d}`);
}

export function cookieKey(c: CookieLike): string {
  return `${c.name}|${c.domain}|${c.path}|${c.partitionKey ? 'partitioned' : ''}`;
}

export function thirdPartyCookies<T extends CookieLike>(
  firstParty: T[],
  byHost: Record<string, T[]>,
): ThirdPartyCookie<T>[] {
  const seenFirst = new Set(firstParty.map(cookieKey));
  const found = new Map<string, ThirdPartyCookie<T>>();
  for (const host of Object.keys(byHost).sort()) {
    for (const c of byHost[host] ?? []) {
      if (c.sameSite !== 'no_restriction') continue; // never sent cross-site
      const key = cookieKey(c);
      if (seenFirst.has(key)) continue; // already counted as a cookie of the site
      // The same cookie (e.g. on .doubleclick.net) is returned for every subdomain
      // contacted: keep it once and remember all the hosts.
      const entry = found.get(key);
      if (entry) entry.hosts.push(host);
      else found.set(key, { cookie: c, hosts: [host] });
    }
  }
  return [...found.values()];
}
