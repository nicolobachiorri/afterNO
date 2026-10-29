import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onTopLevelPage, readTabHosts } from './tabstore.ts';

test('current format is read as it is', () => {
  const v = { pageUrl: 'https://www.ilmeteo.it/', lastSeen: { 'a.com': 5 } };
  assert.deepEqual(readTabHosts(v), v);
});

test('the older format (a list of hosts) becomes hosts seen at time 0', () => {
  assert.deepEqual(readTabHosts({ pageUrl: 'https://x.it/', hosts: ['a.com', 'b.com'] }),
    { pageUrl: 'https://x.it/', lastSeen: { 'a.com': 0, 'b.com': 0 } });
});

test('anything else is ignored', () => {
  assert.equal(readTabHosts(undefined), undefined);
  assert.equal(readTabHosts({ hosts: ['a.com'] }), undefined);
  assert.equal(readTabHosts({ pageUrl: 'https://x.it/' }), undefined);
});

test('ilMeteo case: a reload keeps the hosts contacted right after the choice', () => {
  const before = { pageUrl: 'https://www.ilmeteo.it/', lastSeen: { 'www.ilmeteo.it': 1, 'dpm.demdex.net': 10_600 } };
  const after = onTopLevelPage(before, 'https://www.ilmeteo.it/', 'www.ilmeteo.it', 15_200);
  assert.equal(after.lastSeen['dpm.demdex.net'], 10_600);
  assert.equal(after.lastSeen['www.ilmeteo.it'], 15_200);
});

test('another page of the same site keeps the list; another site starts a new one', () => {
  const before = { pageUrl: 'https://www.ilmeteo.it/', lastSeen: { 'dpm.demdex.net': 5 } };
  assert.ok('dpm.demdex.net' in onTopLevelPage(before, 'https://news.ilmeteo.it/x', 'news.ilmeteo.it', 9).lastSeen);
  assert.deepEqual(onTopLevelPage(before, 'https://www.ikea.com/', 'www.ikea.com', 9).lastSeen, { 'www.ikea.com': 9 });
  assert.deepEqual(onTopLevelPage(undefined, 'https://a.it/', 'a.it', 1).lastSeen, { 'a.it': 1 });
});
