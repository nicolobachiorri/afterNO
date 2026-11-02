// Unit tests for classify.ts, using the test runner built into Node (no install needed).
// Run from the extension folder with:  node --test lib/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, countByCategory, isGenericName, type CookieDb } from './classify.ts';

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

const withOwners: CookieDb = {
  exact: {
    CC: ['Marketing', 'Bing / Microsoft', ['microsoft.com']],
    t: ['Functional', 'Salesforce'],
    _fbp: ['Marketing', 'Facebook', ['facebook.com']],
  },
  prefixes: [['mp_', 'Analytics', 'Mixpanel'], ['_s', 'Analytics', 'Marfeel', ['events.newsroom.bi']]],
};

test('TheFork case: a generic name off the platform\'s site is not trusted', () => {
  assert.equal(classify('CC', withOwners, 'www.thefork.it').category, 'Unknown');
  assert.equal(classify('CC', withOwners, '.microsoft.com').platform, 'Bing / Microsoft');
  assert.equal(classify('t', withOwners, 'shop.it').category, 'Unknown'); // owners unknown
});

test('distinctive names are trusted anywhere: _fbp is set on other sites by design', () => {
  assert.equal(classify('_fbp', withOwners, '.shop.it').category, 'Marketing');
});

test('short prefixes: "_s" must not swallow _session; "mp_" stays distinctive', () => {
  assert.equal(classify('_session_id', withOwners, 'www.shop.it').category, 'Unknown');
  assert.equal(classify('_sp_ses', withOwners, 'events.newsroom.bi').platform, 'Marfeel');
  assert.equal(classify('mp_abc_mixpanel', withOwners, 'www.shop.it').platform, 'Mixpanel');
});

test('without a domain the name rule works as before', () => {
  assert.equal(classify('CC', withOwners).category, 'Marketing');
});

test('generic names', () => {
  for (const n of ['CC', 's', 'uid', 'Lang', 'session']) assert.equal(isGenericName(n, false), true, n);
  for (const n of ['_ga', '_fbp', 'MUID', 'datr', 'IDE5']) assert.equal(isGenericName(n, false), false, n);
  assert.equal(isGenericName('CT', true), true);
  assert.equal(isGenericName('mp_', true), false);
});

test('sessionid (Django default) is generic: Instagram only on instagram.com', () => {
  const db: CookieDb = { exact: { sessionid: ['Marketing', 'Instagram', ['instagram.com']] }, prefixes: [] };
  assert.equal(classify('sessionid', db, 'www.feltrinellieditore.it').category, 'Unknown');
  assert.equal(classify('sessionid', db, '.instagram.com').platform, 'Instagram');
});
