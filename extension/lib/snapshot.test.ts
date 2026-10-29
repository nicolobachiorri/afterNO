import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CookieDb } from './classify.ts';
import {
  buildSnapshot, classifyCookie, hostsSince, shouldTakeSnapshot, SNAPSHOT_DEDUP_MS,
  type Classified,
} from './snapshot.ts';

const NOW = Date.UTC(2026, 9, 29);
const db: CookieDb = {
  exact: { IMRID: ['Marketing', 'Nielsen'], _ga: ['Analytics', 'Google Analytics'] },
  prefixes: [],
};
const year = NOW / 1000 + 365 * 86_400;

test('tracker cookie: known category, or the identifier hint when unknown', () => {
  assert.equal(classifyCookie({ name: 'IMRID', domain: '.imrworldwide.com' }, db, true, NOW).group, 'Marketing');
  const unknown = { name: 'cg_uuid', domain: 'obs.x.com', sameSite: 'no_restriction', expirationDate: year };
  assert.equal(classifyCookie(unknown, db, true, NOW).group, 'Identifier');
});

test('site cookie: unknown stays unknown, even with the shape of an identifier', () => {
  const c = { name: 'tracking_user_id', domain: '.ilmeteo.it', sameSite: 'no_restriction', expirationDate: year };
  assert.equal(classifyCookie(c, db, false, NOW).group, 'Unknown');
});

test('hostsSince keeps the hosts contacted at or after the given moment', () => {
  const seen = { 'a.com': 100, 'b.com': 200, 'c.com': 300 };
  assert.deepEqual(hostsSince(seen, 200), ['b.com', 'c.com']);
  assert.deepEqual(hostsSince(seen, 301), []);
  assert.deepEqual(hostsSince({}, 0), []);
});

test('a snapshot keeps the summary and only the cookies that can recognise', () => {
  const c = (name: string, domain: string, group: Classified['group']): Classified =>
    ({ name, domain, group, platform: '' });
  const snap = buildSnapshot('ilmeteo.it', NOW,
    [c('_ga', '.ilmeteo.it', 'Analytics'), c('DRUPALSESF', 'www.ilmeteo.it', 'Unknown')],
    [c('IMRID', '.imrworldwide.com', 'Marketing'), c('__cf_bm', '.twitter.com', 'Functional')]);
  assert.equal(snap.summary.recognisingSites, 1);
  assert.deepEqual(snap.recognising.map((r) => r.name).sort(), ['IMRID', '_ga']);
});

test('the first snapshot of a choice wins, a later choice takes a new one', () => {
  const snap = buildSnapshot('s.it', NOW, [], []);
  assert.equal(shouldTakeSnapshot(undefined, NOW), true);
  assert.equal(shouldTakeSnapshot(snap, NOW + 500), false); // the TCF event right after the click
  assert.equal(shouldTakeSnapshot(snap, NOW + SNAPSHOT_DEDUP_MS), true);
});
