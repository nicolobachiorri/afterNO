// Shape and keys of what the background saves in storage.session.
// It lives in lib/ because both the background and the popup use it: importing it
// from an entrypoint would pull the whole background code into the popup.
import { siteOf } from './hosts.ts';

export interface TabHosts {
  pageUrl: string; // the top-level page the hosts belong to
  // Every host the tab contacted while showing that page, with the last time
  // (milliseconds) it was contacted: "after the choice" means lastSeen >= choice time.
  lastSeen: Record<string, number>;
}

// A new top-level page in the tab. On the same site (a reload, or another page of
// the site) the list goes on: what the site's pages contacted right after the choice
// must not be lost when the page reloads, and that is often when trackers exchange
// identifiers. On another site the list starts again.
export function onTopLevelPage(previous: TabHosts | undefined, url: string, host: string, now: number): TabHosts {
  const sameSite = previous !== undefined && siteOf(new URL(previous.pageUrl).hostname) === siteOf(host);
  return { pageUrl: url, lastSeen: { ...(sameSite ? previous.lastSeen : {}), [host]: now } };
}

export const tabKey = (tabId: number): string => `tab:${tabId}`;

// The choice made in the banner is stored per site, not per tab: the same site in
// another tab, or after a reload, still shows it. Wiped when the browser closes.
export const choiceKey = (site: string): string => `choice:${site}`;

// The snapshot taken at the moment of the choice, per site like the choice.
export const snapshotKey = (site: string): string => `snapshot:${site}`;

// Reads what was saved, also in the older format (a plain list of hosts, without
// times), so that a browser session started with an older version keeps working.
export function readTabHosts(value: unknown): TabHosts | undefined {
  const v = value as { pageUrl?: unknown; lastSeen?: unknown; hosts?: unknown } | undefined;
  if (!v || typeof v.pageUrl !== 'string') return undefined;
  if (v.lastSeen && typeof v.lastSeen === 'object') {
    return { pageUrl: v.pageUrl, lastSeen: v.lastSeen as Record<string, number> };
  }
  if (Array.isArray(v.hosts)) {
    return { pageUrl: v.pageUrl, lastSeen: Object.fromEntries(v.hosts.map((h: string) => [h, 0])) };
  }
  return undefined;
}
