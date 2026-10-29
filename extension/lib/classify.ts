// Cookie classification: the same rule as divergence_test.py, in TypeScript.
// Exact name first; otherwise the longest matching prefix; otherwise "Unknown".
// This file has no browser code in it, so it can be tested with plain Node.

export type Category =
  | 'Functional' | 'Necessary' | 'Preferences' | 'Personalization'
  | 'Analytics' | 'Marketing' | 'Security' | 'Unknown';

export interface CookieDb {
  exact: Record<string, [string, string]>; // name -> [category, platform]
  prefixes: [string, string, string][]; // [prefix, category, platform], longest first
}

export interface Classification {
  category: Category;
  platform: string;
}

export const TRACKING: ReadonlySet<Category> = new Set(['Analytics', 'Marketing']);

const KNOWN = new Set<string>([
  'Functional', 'Necessary', 'Preferences', 'Personalization',
  'Analytics', 'Marketing', 'Security',
]);

function toCategory(raw: string): Category {
  return KNOWN.has(raw) ? (raw as Category) : 'Unknown';
}

export function classify(name: string, db: CookieDb): Classification {
  const hit = db.exact[name];
  if (hit) return { category: toCategory(hit[0]), platform: hit[1] };
  // The prefixes are already sorted longest first, so the first match is the most specific.
  for (const [prefix, category, platform] of db.prefixes) {
    if (name.startsWith(prefix)) return { category: toCategory(category), platform };
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
