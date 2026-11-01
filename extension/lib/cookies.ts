// Reading cookies from the browser: the one part of lib/ that calls browser APIs,
// so it is not unit-tested with Node. Shared by the background (snapshot at the
// moment of the choice) and the popup (the current state), so that both columns of
// the comparison are measured in exactly the same way.
import { browser, type Browser } from 'wxt/browser';
import type { CookieDb } from './classify.ts';
import type { DescriptionDb } from './describe.ts';
import { isThirdParty, siteOf } from './hosts.ts';
import { classifyCookie, type Classified } from './snapshot.ts';
import { cookieKey, domainMatches, thirdPartyCookies } from './thirdparty.ts';

type Cookie = Browser.cookies.Cookie;

let db: Promise<CookieDb> | undefined;

// The database ships inside the extension (public/cookie-db.json): no network request.
// Loaded once per context and kept.
export function loadDb(): Promise<CookieDb> {
  db ??= fetch(browser.runtime.getURL('/cookie-db.json')).then((r) => r.json() as Promise<CookieDb>);
  return db;
}

let descriptions: Promise<DescriptionDb> | undefined;

// English descriptions (public/cookie-desc.json): only the popup loads them.
export function loadDescriptions(): Promise<DescriptionDb> {
  descriptions ??= fetch(browser.runtime.getURL('/cookie-desc.json')).then((r) => r.json() as Promise<DescriptionDb>);
  return descriptions;
}

export interface Observation {
  own: Classified[];
  trackers: Classified[];
}

// Every cookie of a site (all its subdomains, every path), plus those it keeps in this
// page's partition. Partitioned cookies live in a separate jar per top-level site and
// a plain getAll does not return them; Firefox puts every third-party cookie there by
// default. Browsers without partitions reject the option: then there are none.
async function cookiesOfSite(site: string, topLevelSite: string): Promise<Cookie[]> {
  const plain = await browser.cookies.getAll({ domain: site });
  const partitioned = await browser.cookies.getAll({ domain: site, partitionKey: { topLevelSite } })
    .catch(() => [] as Cookie[]);
  const seen = new Set<string>();
  return [...plain, ...partitioned].filter((c) => !seen.has(cookieKey(c)) && seen.add(cookieKey(c)));
}

// The site's own cookies, and the cookies the given hosts (those the page contacted)
// can read. Hosts of the same site as the page are skipped.
// Read by domain, not by address: asking for the cookies of "https://host/" returns
// only those of the root path, and missed trackers that keep their identifier under
// a path (measurement, visit A: ilpost, giallozafferano, libero).
export async function observe(pageUrl: string, hosts: string[], nowMs: number): Promise<Observation> {
  const cookieDb = await loadDb();
  const pageHost = new URL(pageUrl).hostname;
  const topLevelSite = `https://${siteOf(pageHost)}`;
  const firstParty = await cookiesOfSite(siteOf(pageHost), topLevelSite);
  const third = hosts.filter((h) => isThirdParty(h, pageHost));
  const sites = [...new Set(third.map(siteOf))];
  const bySite = Object.fromEntries(await Promise.all(sites.map(async (s) => [s, await cookiesOfSite(s, topLevelSite)] as const)));
  const byHost: Record<string, Cookie[]> = {};
  for (const host of third) byHost[host] = (bySite[siteOf(host)] ?? []).filter((c) => domainMatches(c, host));
  const trackers = thirdPartyCookies(firstParty, byHost).map((f) => f.cookie);
  return {
    own: firstParty.map((c) => classifyCookie(c, cookieDb, false, nowMs)),
    trackers: trackers.map((c) => classifyCookie(c, cookieDb, true, nowMs)),
  };
}
