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

// Words that end with a full stop without ending the sentence.
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'approx', 'incl', 'no', 'ca', 'inc', 'ltd', 'co']);

// Splits a description into its first sentence and the rest, so the popup can show
// the first and keep the rest one tap away. A sentence ends at . ! or ? followed by
// a space and a capital letter (or a quote or bracket), unless the word before the
// stop is a known abbreviation. Very short first sentences are not cut.
export function firstSentence(text: string): { first: string; rest: string } {
  const ends = /[.!?]\s+(?=[A-Z"'(])/g;
  for (let m = ends.exec(text); m; m = ends.exec(text)) {
    const end = m.index + 1;
    const word = text.slice(0, m.index).split(/\s/).pop()?.toLowerCase() ?? '';
    if (end < 20 || ABBREVIATIONS.has(word)) continue;
    return { first: text.slice(0, end), rest: text.slice(end).trim() };
  }
  return { first: text, rest: '' };
}
