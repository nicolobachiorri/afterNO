import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChoiceRecord } from './choice.ts';
import { buildVerdict, namesBySite, type Row } from './verdict.ts';

const r = (domain: string, group: Row['group'], platform = ''): Row => ({ domain, group, platform });
const tcfReject: ChoiceRecord = {
  site: 'ilmeteo.it', source: 'tcf', choice: 'rejected', at: 0, trigger: 'action',
  purposesConsented: 0, purposesTotal: 11, legitimateInterests: 0,
};
const keys = (v: ReturnType<typeof buildVerdict>) => v.items.map((i) => `${i.mark}:${i.key}`);

test('ilMeteo case: rejection recorded, but third parties can still recognise: partly respected', () => {
  const v = buildVerdict(tcfReject,
    [r('.ilmeteo.it', 'Marketing', 'Google Ads'), r('.ilmeteo.it', 'Analytics', 'Google Analytics')],
    [r('.demdex.net', 'Marketing', 'Adobe Audience Manager'), r('.sky.it', 'Marketing', 'Adobe Analytics'),
      r('.newsroom.bi', 'Identifier')]);
  assert.deepEqual(keys(v), [
    'ok:itemTcfRecorded', 'bad:itemThirdPartyStill', 'bad:itemSiteMarketing', 'info:itemSiteAnalytics',
  ]);
  assert.deepEqual(v.items[1]?.names, ['Adobe Audience Manager (demdex.net)', 'Adobe Analytics (sky.it)', 'newsroom.bi']);
  assert.deepEqual(v.conclusion, { key: 'verdictPartly', tone: 'alert' });
});

test('IKEA case: clean after a rejection by click: seems respected, with the limit stated', () => {
  const click: ChoiceRecord = { site: 'ikea.com', source: 'click', choice: 'rejected', at: 0, trigger: 'action', label: 'Rifiutare' };
  const v = buildVerdict(click, [r('.ikea.com', 'Functional')], []);
  assert.deepEqual(keys(v), ['info:itemClickOnly', 'ok:itemNoThirdParty', 'ok:itemNoSiteMarketing']);
  assert.deepEqual(v.conclusion, { key: 'verdictRespected', tone: 'ok' });
});

test('Pinterest case: no third parties, only the site\'s own marketing cookie: partly, in amber', () => {
  const click: ChoiceRecord = { site: 'pinterest.com', source: 'click', choice: 'rejected', at: 0, trigger: 'action', label: 'Rifiuta tutto' };
  const v = buildVerdict(click, [r('it.pinterest.com', 'Marketing', 'Pinterest')], []);
  assert.deepEqual(v.conclusion, { key: 'verdictPartly', tone: 'warn' });
});

test('legitimate interest still active after a rejection counts against', () => {
  const v = buildVerdict({ ...tcfReject, legitimateInterests: 3 }, [], []);
  assert.ok(keys(v).includes('bad:itemLegitimate'));
  assert.equal(v.conclusion?.key, 'verdictPartly');
});

test('analytics alone never makes a rejection "partly respected"', () => {
  const v = buildVerdict(tcfReject, [r('.x.it', 'Analytics', 'Google Analytics')], []);
  assert.deepEqual(v.conclusion, { key: 'verdictRespected', tone: 'ok' });
});

test('after an acceptance, trackers are information, not faults', () => {
  const v = buildVerdict({ ...tcfReject, choice: 'accepted' }, [r('.x.it', 'Marketing', 'X')], [r('.criteo.com', 'Marketing', 'Criteo')]);
  assert.ok(v.items.every((i) => i.mark !== 'bad'));
  assert.equal(v.conclusion?.key, 'verdictAccepted');
});

test('no choice recorded: what is active is active without consent', () => {
  const v = buildVerdict(undefined, [], [r('.criteo.com', 'Marketing', 'Criteo')]);
  assert.ok(keys(v).includes('bad:itemThirdPartyNoChoice'));
  assert.equal(v.conclusion, undefined); // no conclusion about a choice that was not made
});

test('without the page\'s requests, no conclusion: reload', () => {
  const v = buildVerdict(tcfReject, [], null);
  assert.deepEqual(v.conclusion, { key: 'verdictNeedReload', tone: 'muted' });
});

test('names: one per third-party site, with the platform when known', () => {
  assert.deepEqual(namesBySite([
    r('.doubleclick.net', 'Marketing', 'Google'), r('stats.g.doubleclick.net', 'Analytics', 'Google'),
    r('obs.brilliantchap.com', 'Identifier'),
  ]), ['Google (doubleclick.net)', 'brilliantchap.com']);
});
