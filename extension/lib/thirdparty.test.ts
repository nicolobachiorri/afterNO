import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thirdPartyCookies, type CookieLike } from './thirdparty.ts';

const c = (name: string, domain: string, sameSite = 'no_restriction'): CookieLike =>
  ({ name, domain, path: '/', sameSite });

test('only SameSite=None cookies are kept, because only they are sent cross-site', () => {
  const out = thirdPartyCookies([], {
    'gum.criteo.com': [c('uid', '.criteo.com'), c('lax_one', '.criteo.com', 'lax'),
      c('unspec', '.criteo.com', 'unspecified')],
  });
  assert.deepEqual(out.map((x) => x.cookie.name), ['uid']);
});

test('a cookie returned for several subdomains is counted once, with all its hosts', () => {
  const ide = c('IDE', '.doubleclick.net');
  const out = thirdPartyCookies([], {
    'stats.g.doubleclick.net': [ide],
    'ad.doubleclick.net': [ide],
  });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0]?.hosts, ['ad.doubleclick.net', 'stats.g.doubleclick.net']);
});

test('cookies already counted as the site\'s own are not repeated', () => {
  const ga = c('_ga', '.ilmeteo.it');
  const out = thirdPartyCookies([ga], { 'cdn.ilmeteo.it': [ga] });
  assert.equal(out.length, 0);
});

test('same name on different domains are different cookies', () => {
  const out = thirdPartyCookies([], {
    'a.tracker1.com': [c('uid', '.tracker1.com')],
    'b.tracker2.com': [c('uid', '.tracker2.com')],
  });
  assert.equal(out.length, 2);
});

test('no hosts contacted, no tracker cookies', () => {
  assert.deepEqual(thirdPartyCookies([c('x', '.site.it')], {}), []);
});
