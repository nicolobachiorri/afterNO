// Snapshots: what could recognise the user at a given moment.
// The background takes one at the moment of the choice (everything there appeared
// before consent or refusal); the popup builds the current one. Both use the same
// functions, so the two columns of the comparison are measured the same way.
import { classify, type CookieDb } from './classify.ts';
import { isLikelyIdentifier } from './identifiers.ts';
import { RECOGNISING, summarise, type Group, type Summary } from './summary.ts';

export interface CookieInfo {
  name: string;
  domain: string;
  sameSite?: string;
  session?: boolean;
  expirationDate?: number; // seconds since the epoch
  partitionKey?: unknown;
}

export interface Classified {
  name: string;
  domain: string;
  group: Group;
  platform: string;
  owners?: string[]; // domains the database says the cookie belongs to
  partitioned?: boolean; // kept for this top-level site only
  session?: boolean;
  expirationDate?: number;
}

// Category from the database; for a tracker's unknown cookie, the "likely identifier"
// hint. On the site's own domain, "unknown" really means "we do not know".
export function classifyCookie(c: CookieInfo, db: CookieDb, thirdParty: boolean, nowMs: number): Classified {
  const { category, platform, owners } = classify(c.name, db, c.domain);
  const group: Group = thirdParty && isLikelyIdentifier(c, category, nowMs) ? 'Identifier' : category;
  return {
    name: c.name, domain: c.domain, group, platform,
    ...(owners ? { owners } : {}), ...(c.partitionKey ? { partitioned: true } : {}),
    session: c.session, expirationDate: c.expirationDate,
  };
}

// Hosts contacted at or after `since`, from a map host -> last time it was contacted.
// Used for the "now" column: only trackers contacted after the choice count.
export function hostsSince(lastSeen: Record<string, number>, since: number): string[] {
  return Object.entries(lastSeen).filter(([, t]) => t >= since).map(([h]) => h).sort();
}

export interface Snapshot {
  site: string;
  at: number;
  summary: Summary;
  // The cookies that can recognise the user, kept for a future receipt.
  recognising: { name: string; domain: string; group: Group }[];
}

export function buildSnapshot(site: string, at: number, own: Classified[], trackers: Classified[]): Snapshot {
  return {
    site,
    at,
    summary: summarise(own, trackers),
    recognising: [...own, ...trackers]
      .filter((c) => RECOGNISING.has(c.group))
      .map(({ name, domain, group }) => ({ name, domain, group })),
  };
}

// A choice reported twice (the click, then the TCF event a moment later) must not
// replace the snapshot taken at the first: that one is closer to "before the choice".
export const SNAPSHOT_DEDUP_MS = 60_000;

export function shouldTakeSnapshot(existing: Snapshot | undefined, at: number): boolean {
  return !existing || at - existing.at >= SNAPSHOT_DEDUP_MS;
}
