// Unit tests for classify.ts, using the test runner built into Node (no install needed).
// Run from the extension folder with:  node --test lib/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, countByCategory, type CookieDb } from './classify.ts';

const db: CookieDb = {
  exact: {
    _ga: ['Analytics', 'Google Analytics'],
    _fbp: ['Marketing', 'Meta'],
    _routing_id: ['Marketing', 'Pinterest', ['pinterest.com']],
    cto_bundle: ['Marketing', 'Criteo'],
    weird: ['SomethingNew', 'X'],
  },
  // Longest first, as written by build_cookie_db.py.
  prefixes: [
    ['_gac_gb_', 'Marketing', 'Google Ads'],
    ['_gac_', 'Analytics', 'Google'],
  ],
};

test('exact name wins', () => {
  assert.deepEqual(classify('_ga', db), { category: 'Analytics', platform: 'Google Analytics' });
});

test('wildcard name matches its prefix', () => {
  assert.equal(classify('_gac_1234', db).category, 'Analytics');
});

test('the longest prefix wins over a shorter one', () => {
  assert.deepEqual(classify('_gac_gb_999', db), { category: 'Marketing', platform: 'Google Ads' });
});

test('an unknown cookie is reported as Unknown, not dropped', () => {
  assert.deepEqual(classify('ilpost-token', db), { category: 'Unknown', platform: '' });
});

test('a category the code does not know becomes Unknown', () => {
  assert.equal(classify('weird', db).category, 'Unknown');
});

test('counts include every category, also the empty ones', () => {
  const counts = countByCategory(['Analytics', 'Marketing', 'Marketing']);
  assert.equal(counts.Marketing, 2);
  assert.equal(counts.Analytics, 1);
  assert.equal(counts.Functional, 0);
  assert.equal(Object.keys(counts).length, 8);
});

test('owner domains are passed on when the database has them, absent otherwise', () => {
  assert.deepEqual(classify('_routing_id', db), { category: 'Marketing', platform: 'Pinterest', owners: ['pinterest.com'] });
  assert.equal('owners' in classify('_ga', db), false);
});
