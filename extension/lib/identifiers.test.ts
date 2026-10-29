import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyIdentifier, MIN_IDENTIFIER_DAYS } from './identifiers.ts';

const NOW = Date.UTC(2026, 9, 29); // fixed clock: tests must not depend on today's date
const inDays = (d: number) => NOW / 1000 + d * 86_400;

test('unknown, SameSite=None, 11 months: likely identifier (like cg_uuid)', () => {
  assert.equal(isLikelyIdentifier({ sameSite: 'no_restriction', expirationDate: inDays(330) }, 'Unknown', NOW), true);
});

test('exactly at the threshold counts, one day less does not', () => {
  const c = (d: number) => ({ sameSite: 'no_restriction', expirationDate: inDays(d) });
  assert.equal(isLikelyIdentifier(c(MIN_IDENTIFIER_DAYS), 'Unknown', NOW), true);
  assert.equal(isLikelyIdentifier(c(MIN_IDENTIFIER_DAYS - 1), 'Unknown', NOW), false);
});

test('session cookies are not identifiers across visits', () => {
  assert.equal(isLikelyIdentifier({ sameSite: 'no_restriction', session: true }, 'Unknown', NOW), false);
});

test('cookies that are not sent cross-site do not qualify', () => {
  assert.equal(isLikelyIdentifier({ sameSite: 'lax', expirationDate: inDays(365) }, 'Unknown', NOW), false);
});

test('a cookie the database knows keeps its category', () => {
  assert.equal(isLikelyIdentifier({ sameSite: 'no_restriction', expirationDate: inDays(365) }, 'Functional', NOW), false);
});
