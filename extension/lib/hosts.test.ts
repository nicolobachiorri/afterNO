import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteOf, isThirdParty } from './hosts.ts';

test('subdomains of the same site share the site', () => {
  assert.equal(siteOf('www.ilmeteo.it'), 'ilmeteo.it');
  assert.equal(siteOf('static.ilmeteo.it'), 'ilmeteo.it');
  assert.equal(siteOf('tgcom24.mediaset.it'), 'mediaset.it');
});

test('two-label suffixes keep three labels', () => {
  assert.equal(siteOf('www.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(siteOf('shop.example.com.au'), 'example.com.au');
});

test('IP addresses and localhost are their own site', () => {
  assert.equal(siteOf('127.0.0.1'), '127.0.0.1');
  assert.equal(siteOf('localhost'), 'localhost');
});

test('case and trailing dot do not matter', () => {
  assert.equal(siteOf('WWW.IlMeteo.IT.'), 'ilmeteo.it');
});

test('third party means a different site', () => {
  assert.equal(isThirdParty('static.ilmeteo.it', 'www.ilmeteo.it'), false);
  assert.equal(isThirdParty('gum.criteo.com', 'www.ilmeteo.it'), true);
});
