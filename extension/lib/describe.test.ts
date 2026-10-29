import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, firstSentence, type DescriptionDb } from './describe.ts';

const db: DescriptionDb = {
  exact: { _ga: 'ID used to identify users' },
  prefixes: [['_gac_gb_', 'Google Ads, UK'], ['_gac_', 'Google Ads']],
};

test('exact name, then the longest prefix, then nothing', () => {
  assert.equal(describe('_ga', db), 'ID used to identify users');
  assert.equal(describe('_gac_gb_1', db), 'Google Ads, UK');
  assert.equal(describe('_gac_1', db), 'Google Ads');
  assert.equal(describe('session', db), undefined);
});

test('first sentence: cut at the first real end of sentence', () => {
  assert.deepEqual(firstSentence('Used to avoid the repeated display of the same ad. Contains information about the users location.'),
    { first: 'Used to avoid the repeated display of the same ad.', rest: 'Contains information about the users location.' });
});

test('first sentence: abbreviations and short openings do not cut', () => {
  assert.equal(firstSentence('Stores settings, e.g. Language and currency, for the visit. More text.').first,
    'Stores settings, e.g. Language and currency, for the visit.');
  assert.equal(firstSentence('Ad ID. Used by the ad server to manage ads. And more.').first, 'Ad ID. Used by the ad server to manage ads.');
});

test('first sentence: a single sentence, or a version number, stays whole', () => {
  assert.deepEqual(firstSentence('ID used to identify users'), { first: 'ID used to identify users', rest: '' });
  assert.equal(firstSentence('Set by the Google Analytics 4.0 tag on every page view').rest, '');
});
