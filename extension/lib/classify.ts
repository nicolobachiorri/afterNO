// Cookie classification: the same rule as divergence_test.py, in TypeScript.
// Exact name first; otherwise the longest matching prefix; otherwise "Unknown".
// This file has no browser code in it, so it can be tested with plain Node.

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

export function classify(name: string, db: CookieDb): Classification {
  const hit = db.exact[name];
  if (hit) return result(hit[0], hit[1], hit[2]);
  // The prefixes are already sorted longest first, so the first match is the most specific.
  for (const [prefix, category, platform, owners] of db.prefixes) {
    if (name.startsWith(prefix)) return result(category, platform, owners);
  }
  return { category: 'Unknown', platform: '' };
}

// Counts per category, with every category present (also when zero).
export function countByCategory(categories: Category[]): Record<Category, number> {
  const counts = {
    Functional: 0, Necessary: 0, Preferences: 0, Personalization: 0,
    Analytics: 0, Marketing: 0, Security: 0, Unknown: 0,
  } satisfies Record<Category, number>;
  for (const c of categories) counts[c] += 1;
  return counts;
}
