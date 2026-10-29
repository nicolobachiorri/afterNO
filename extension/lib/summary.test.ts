import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, type RowLike } from './summary.ts';

const r = (domain: string, group: RowLike['group']): RowLike => ({ domain, group });

test('counts marketing and analytics separately for site and trackers', () => {
  const s = summarise(
    [r('.ilmeteo.it', 'Marketing'), r('.ilmeteo.it', 'Analytics'), r('.ilmeteo.it', 'Analytics')],
    [r('.criteo.com', 'Marketing'), r('.criteo.com', 'Marketing')],
  );
  assert.deepEqual(s.marketing, { site: 1, trackers: 2 });
  assert.deepEqual(s.analytics, { site: 2, trackers: 0 });
});

test('a third-party site is counted once, whatever its subdomains', () => {
  const s = summarise([], [
    r('.doubleclick.net', 'Marketing'),
    r('stats.g.doubleclick.net', 'Analytics'),
    r('.criteo.com', 'Identifier'),
  ]);
  assert.equal(s.recognisingSites, 2);
  assert.equal(s.identifiers, 1);
});

test('sites with only functional or unknown short-lived cookies do not count', () => {
  const s = summarise([], [r('.twitter.com', 'Functional'), r('.example.com', 'Unknown')]);
  assert.equal(s.recognisingSites, 0);
});

test('the site\'s own cookies never count as third-party sites', () => {
  const s = summarise([r('.ilmeteo.it', 'Marketing')], []);
  assert.equal(s.recognisingSites, 0);
});
