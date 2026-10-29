import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, type DescriptionDb } from './describe.ts';

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
