// Cookie classification: the same rule as divergence_test.py, in TypeScript.
// Exact name first; otherwise the longest matching prefix; otherwise "Unknown".
// This file has no browser code in it, so it can be tested with plain Node.
import { siteOf } from './hosts.ts';

export type Category =
  | 'Functional' | 'Necessary' | 'Preferences' | 'Personalization'
  | 'Analytics' | 'Marketing' | 'Security' | 'Unknown';

// Owners: the domains the database says the cookie belongs to ("pinterest.com"),
// present only when the database states them.
export interface CookieDb {
  exact: Record<string, [string, string, string[]?]>; // name -> [category, platform, owners?]
  prefixes: [string, string, string, string[]?][]; // [prefix, category, platform, owners?], longest first
  meta?: { data_date?: string }; // data_date: YYYY-MM-DD, the day the data was taken
}

export interface Classification {
  category: Category;
  platform: string;
  owners?: string[];
}

export const TRACKING: ReadonlySet<Category> = new Set(['Analytics', 'Marketing']);

const KNOWN = new Set<string>([
  'Functional', 'Necessary', 'Preferences', 'Personalization',
  'Analytics', 'Marketing', 'Security',
]);

function toCategory(raw: string): Category {
  return KNOWN.has(raw) ? (raw as Category) : 'Unknown';
}

function result(category: string, platform: string, owners?: string[]): Classification {
  return owners?.length ? { category: toCategory(category), platform, owners } : { category: toCategory(category), platform };
}

// Generic names: short or common words that many unrelated sites also use. For them
// the database only says "some platform has a cookie with this name", not "this is
// that cookie": "CC" is Microsoft's on microsoft.com and someone else's elsewhere.
// Names starting with "_" (_ga, _fbp) are distinctive enough, and are exactly the
// cookies platforms place on other sites' domains, so they are not generic.
// Prefixes ending with "_" or "-" (mp_, sb-) are distinctive too.
const GENERIC_WORDS = new Set([
  'id', 'uid', 'uids', 'uuid', 'auid', 'cid', 'pid', 'did', 'sid', 'ssid', 'oid',
  'lang', 'test', 'sess', 'session', 'sync', 'hash', 'cart', 'token', 'user', 'gdpr', 'cmp',
]);

export function isGenericName(name: string, prefix: boolean): boolean {
  if (prefix) return name.length <= 3 && !/[_-]$/.test(name);
  return (name.length <= 3 && !name.startsWith('_')) || GENERIC_WORDS.has(name.toLowerCase());
}

// A generic name counts only on the platform's own site (one of the owner domains);
// anywhere else, or when the owners are not known, it is "Unknown".
function trusted(name: string, prefix: boolean, owners: string[] | undefined, domain: string | undefined): boolean {
  if (domain === undefined || !isGenericName(name, prefix)) return true;
  const site = siteOf(domain.replace(/^\./, ''));
  return (owners ?? []).some((o) => siteOf(o.replace(/^\./, '')) === site);
}

// `domain`: where the cookie was found. Without it (old callers, tests of the name
// rule alone) the name is trusted as before.
export function classify(name: string, db: CookieDb, domain?: string): Classification {
  const hit = db.exact[name];
  if (hit) return trusted(name, false, hit[2], domain) ? result(hit[0], hit[1], hit[2]) : UNKNOWN;
  // The prefixes are already sorted longest first, so the first match is the most specific.
  for (const [prefix, category, platform, owners] of db.prefixes) {
    if (name.startsWith(prefix)) return trusted(prefix, true, owners, domain) ? result(category, platform, owners) : UNKNOWN;
  }
  return UNKNOWN;
}

const UNKNOWN: Classification = { category: 'Unknown', platform: '' };

// Counts per category, with every category present (also when zero).
export function countByCategory(categories: Category[]): Record<Category, number> {
  const counts = {
    Functional: 0, Necessary: 0, Preferences: 0, Personalization: 0,
    Analytics: 0, Marketing: 0, Security: 0, Unknown: 0,
  } satisfies Record<Category, number>;
  for (const c of categories) counts[c] += 1;
  return counts;
}
