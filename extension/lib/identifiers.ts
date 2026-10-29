// "Likely identifier": a tracker cookie the database does not know, but whose
// properties say what it is for. A cookie that
//   1. lives on another site's domain (the caller only passes third-party cookies),
//   2. is SameSite=None, so it is sent whenever any site contacts that domain,
//   3. lasts at least MIN_IDENTIFIER_DAYS,
// is built to recognise the same browser across sites, whatever its name.
// It is a hint, shown as such in the popup, not a classification.
import type { Category } from './classify.ts';

export const MIN_IDENTIFIER_DAYS = 30;
const DAY_MS = 86_400_000;

export interface CookieTiming {
  sameSite?: string;
  session?: boolean;
  expirationDate?: number; // seconds since the epoch, as in the extension API
}

export function isLikelyIdentifier(c: CookieTiming, category: Category, nowMs: number): boolean {
  if (category !== 'Unknown') return false; // known cookies keep their category
  if (c.sameSite !== 'no_restriction') return false;
  if (c.session || c.expirationDate === undefined) return false;
  return c.expirationDate * 1000 - nowMs >= MIN_IDENTIFIER_DAYS * DAY_MS;
}
