// Reading cookies from the browser: the one part of lib/ that calls browser APIs,
// so it is not unit-tested with Node. Shared by the background (snapshot at the
// moment of the choice) and the popup (the current state), so that both columns of
// the comparison are measured in exactly the same way.
import { browser, type Browser } from 'wxt/browser';
import type { CookieDb } from './classify.ts';
import type { DescriptionDb } from './describe.ts';
import { isThirdParty } from './hosts.ts';
import { classifyCookie, type Classified } from './snapshot.ts';
import { thirdPartyCookies } from './thirdparty.ts';

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

// The site's own cookies, and the cookies the given hosts (those the page contacted)
// can read. Hosts of the same site as the page are skipped.
export async function observe(pageUrl: string, hosts: string[], nowMs: number): Promise<Observation> {
  const cookieDb = await loadDb();
  const pageHost = new URL(pageUrl).hostname;
  const firstParty = await browser.cookies.getAll({ url: pageUrl });
  const byHost: Record<string, Cookie[]> = {};
  await Promise.all(hosts.filter((h) => isThirdParty(h, pageHost)).map(async (host) => {
    byHost[host] = await browser.cookies.getAll({ url: `https://${host}/` });
  }));
  const trackers = thirdPartyCookies(firstParty, byHost).map((f) => f.cookie);
  return {
    own: firstParty.map((c) => classifyCookie(c, cookieDb, false, nowMs)),
    trackers: trackers.map((c) => classifyCookie(c, cookieDb, true, nowMs)),
  };
}
