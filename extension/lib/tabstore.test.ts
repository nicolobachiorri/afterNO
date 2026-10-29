import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTabHosts } from './tabstore.ts';

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
