import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pluralKey } from './plural.ts';

test('Italian and English: 1 is "one", everything else is "other", zero included', () => {
  for (const locale of ['it', 'en', 'en-GB', 'it-IT']) {
    assert.equal(pluralKey('sites', 1, locale), 'sites_one');
    assert.equal(pluralKey('sites', 0, locale), 'sites_other');
    assert.equal(pluralKey('sites', 4, locale), 'sites_other');
  }
});

test('an invalid locale tag falls back to English rules instead of throwing', () => {
  assert.equal(pluralKey('sites', 1, 'not a locale!'), 'sites_one');
});
