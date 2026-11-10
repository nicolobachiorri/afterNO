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

test('Italian public administrations and provinces are suffixes, as in the Public Suffix List', () => {
  assert.equal(siteOf('www.cultura.gov.it'), 'cultura.gov.it');
  assert.equal(siteOf('pagopa.gov.it'), 'pagopa.gov.it');
  assert.equal(isThirdParty('www.mit.gov.it', 'www.cultura.gov.it'), true);
  assert.equal(siteOf('aosp.bo.it'), 'aosp.bo.it');
  assert.equal(siteOf('www.comune.mi.it'), 'comune.mi.it');
  assert.equal(siteOf('www.unimi.it'), 'unimi.it'); // an ordinary .it site is unchanged
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

test('Austrian universities are separate sites (sample E)', () => {
  assert.equal(siteOf('www.meduniwien.ac.at'), 'meduniwien.ac.at');
  assert.equal(siteOf('www.univie.ac.at'), 'univie.ac.at');
});

test('the Public Suffix List separates sites on shared hosting (external review, 10 November 2026)', () => {
  assert.equal(siteOf('alice.github.io'), 'alice.github.io');
  assert.equal(isThirdParty('alice.github.io', 'bob.github.io'), true);
  assert.equal(siteOf('nicolobachiorri.github.io'), 'nicolobachiorri.github.io');
  assert.equal(isThirdParty('d1.cloudfront.net', 'd2.cloudfront.net'), true);
  assert.equal(siteOf('someblog.blogspot.com'), 'someblog.blogspot.com');
  assert.equal(siteOf('github.io'), 'github.io'); // a suffix is its own site
  assert.equal(siteOf('.www.example.co.uk'), 'example.co.uk'); // cookie domains start with a dot
  // wildcard and exception rules: *.ck and !www.ck
  assert.equal(siteOf('a.b.ck'), 'a.b.ck');
  assert.equal(siteOf('x.www.ck'), 'www.ck');
});
