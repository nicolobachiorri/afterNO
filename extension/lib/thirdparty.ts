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
}

export interface ThirdPartyCookie<T extends CookieLike> {
  cookie: T;
  hosts: string[]; // the contacted hosts this cookie is sent to, sorted
}

export function cookieKey(c: CookieLike): string {
  return `${c.name}|${c.domain}|${c.path}`;
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
