// The numbers at the top of the popup. Kept here, out of the browser code, because
// they are the first thing the user reads and they must be right.
import type { Category } from './classify.ts';
import { siteOf } from './hosts.ts';

// A display group: the database category, plus the "likely identifier" hint.
export type Group = Category | 'Identifier';

export interface RowLike {
  domain: string; // cookie domain, possibly with a leading dot (".criteo.com")
  group: Group;
}

// Groups that let a site recognise the browser across visits or across sites.
export const RECOGNISING: ReadonlySet<Group> = new Set<Group>(['Marketing', 'Analytics', 'Identifier']);

export interface Summary {
  marketing: { site: number; trackers: number };
  analytics: { site: number; trackers: number };
  identifiers: number;
  recognisingSites: number; // third-party sites with at least one RECOGNISING cookie
}

const count = (rows: RowLike[], g: Group) => rows.filter((r) => r.group === g).length;

export function summarise(site: RowLike[], trackers: RowLike[]): Summary {
  const sites = new Set(
    trackers.filter((r) => RECOGNISING.has(r.group)).map((r) => siteOf(r.domain.replace(/^\./, ''))),
  );
  return {
    marketing: { site: count(site, 'Marketing'), trackers: count(trackers, 'Marketing') },
    analytics: { site: count(site, 'Analytics'), trackers: count(trackers, 'Analytics') },
    identifiers: count(trackers, 'Identifier'),
    recognisingSites: sites.size,
  };
}
