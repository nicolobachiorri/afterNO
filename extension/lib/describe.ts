// English descriptions of cookies, from the Open Cookie Database (public/cookie-desc.json).
// Same matching rule as classify.ts: exact name first, then the longest prefix.
// Kept apart from the categories because the file is large and only the popup needs it.

export interface DescriptionDb {
  exact: Record<string, string>;
  prefixes: [string, string][]; // [prefix, description], longest first
}

export function describe(name: string, db: DescriptionDb): string | undefined {
  const hit = db.exact[name];
  if (hit) return hit;
  for (const [prefix, text] of db.prefixes) {
    if (name.startsWith(prefix)) return text;
  }
  return undefined;
}
