import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChoiceRecord } from './choice.ts';
import { buildVerdict, marketingKind, namesBySite, type Row } from './verdict.ts';

// Persistent for a year unless a test says otherwise; "now" is time 0.
const YEAR = 365 * 86_400;
const r = (domain: string, group: Row['group'], platform = '', extra: Partial<Row> = {}): Row =>
  ({ domain, group, platform, expirationDate: YEAR, ...extra });
const tcfReject: ChoiceRecord = {
  site: 'ilmeteo.it', source: 'tcf', choice: 'rejected', at: 0, trigger: 'action',
  purposesConsented: 0, purposesTotal: 11, legitimateInterests: 0,
};
const keys = (v: ReturnType<typeof buildVerdict>) => v.items.map((i) => `${i.mark}:${i.key}`);

test('ilMeteo case: rejection recorded, but third parties can still recognise: partly respected', () => {
  const v = buildVerdict(tcfReject,
    [r('.ilmeteo.it', 'Marketing', 'Google Ads'), r('.ilmeteo.it', 'Analytics', 'Google Analytics')],
    [r('.demdex.net', 'Marketing', 'Adobe Audience Manager'), r('.sky.it', 'Marketing', 'Adobe Analytics'),
      r('.newsroom.bi', 'Identifier')], 0);
  assert.deepEqual(keys(v), [
    'ok:itemTcfRecorded', 'bad:itemThirdPartyStill', 'bad:itemSiteMarketing', 'info:itemSiteAnalytics',
  ]);
  assert.deepEqual(v.items[1]?.names, ['Adobe Audience Manager (demdex.net)', 'Adobe Analytics (sky.it)', 'newsroom.bi']);
  assert.deepEqual(v.conclusion, { key: 'verdictPartly', tone: 'alert' });
});

test('IKEA case: clean after a rejection by click: seems respected, with the limit stated', () => {
  const click: ChoiceRecord = { site: 'ikea.com', source: 'click', choice: 'rejected', at: 0, trigger: 'action', label: 'Rifiutare' };
  const v = buildVerdict(click, [r('.ikea.com', 'Functional')], [], 0);
  assert.deepEqual(keys(v), ['info:itemClickOnly', 'ok:itemNoThirdParty', 'ok:itemNoSiteMarketing']);
  assert.deepEqual(v.conclusion, { key: 'verdictRespected', tone: 'ok' });
});

const pinClick: ChoiceRecord = { site: 'pinterest.com', source: 'click', choice: 'rejected', at: 0, trigger: 'action', label: 'Rifiuta tutto' };

test('Pinterest case: the platform\'s own cookie on its own site is information, not a fault', () => {
  const v = buildVerdict(pinClick,
    [r('it.pinterest.com', 'Marketing', 'Pinterest', { owners: ['pinterest.com'], expirationDate: 86_000 })], [], 0);
  assert.deepEqual(keys(v), ['info:itemClickOnly', 'ok:itemNoThirdParty', 'info:itemSiteMarketingOwn']);
  assert.deepEqual(v.conclusion, { key: 'verdictRespected', tone: 'ok' });
});

test('control: the same Pinterest cookie on another site, lasting a year, still counts against', () => {
  const v = buildVerdict({ ...pinClick, site: 'shop.it' },
    [r('.shop.it', 'Marketing', 'Pinterest', { owners: ['pinterest.com'] })], [], 0);
  assert.ok(keys(v).includes('bad:itemSiteMarketing'));
  assert.deepEqual(v.conclusion, { key: 'verdictPartly', tone: 'warn' });
});

test('a marketing cookie that expires within a day, or with the browser, is information', () => {
  const v = buildVerdict(pinClick, [
    r('.shop.it', 'Marketing', 'X', { expirationDate: 3_600 }),
    r('.shop.it', 'Marketing', 'Y', { session: true, expirationDate: undefined }),
  ], [], 0);
  assert.deepEqual(keys(v), ['info:itemClickOnly', 'ok:itemNoThirdParty', 'info:itemSiteMarketingShort']);
  assert.equal(v.items[2]?.count, 2);
  assert.equal(v.conclusion?.key, 'verdictRespected');
});

test('mixed: only the strong cookies are counted in the cross', () => {
  const v = buildVerdict(pinClick, [
    r('.shop.it', 'Marketing', 'Criteo'), r('.shop.it', 'Marketing', 'X', { session: true, expirationDate: undefined }),
  ], [], 0);
  const bad = v.items.find((i) => i.key === 'itemSiteMarketing');
  assert.deepEqual([bad?.mark, bad?.count, bad?.names], ['bad', 1, ['Criteo']]);
});

test('marketingKind: owner matched by site, not by exact host; a day is the limit', () => {
  assert.equal(marketingKind(r('www.facebook.com', 'Marketing', 'Facebook', { owners: ['.facebook.com'] }), 0), 'own');
  assert.equal(marketingKind(r('.facebook.com.evil.it', 'Marketing', 'Facebook', { owners: ['facebook.com'] }), 0), 'strong');
  assert.equal(marketingKind(r('.x.it', 'Marketing', '', { expirationDate: 86_400 }), 0), 'short');
  assert.equal(marketingKind(r('.x.it', 'Marketing', '', { expirationDate: 86_401 }), 0), 'strong');
});

test('decathlon case: legitimate interest is declared, not observed: information, with the purposes named', () => {
  const v = buildVerdict({ ...tcfReject, legitimateInterests: 1, legitimatePurposes: [7] }, [], [], 0);
  assert.ok(keys(v).includes('info:itemLegitimate'));
  assert.deepEqual(v.items.find((i) => i.key === 'itemLegitimate')?.nameKeys, ['tcfPurpose_7']);
  assert.deepEqual(v.conclusion, { key: 'verdictRespected', tone: 'ok' });
});

test('legitimate interest with trackers: the trackers decide, as before', () => {
  const v = buildVerdict({ ...tcfReject, legitimateInterests: 2, legitimatePurposes: [7, 99] },
    [], [r('.criteo.com', 'Marketing', 'Criteo')], 0);
  assert.deepEqual(v.items.find((i) => i.key === 'itemLegitimate')?.nameKeys, ['tcfPurpose_7']);
  assert.equal(v.conclusion?.key, 'verdictPartly');
});

test('analytics alone never makes a rejection "partly respected"', () => {
  const v = buildVerdict(tcfReject, [r('.x.it', 'Analytics', 'Google Analytics')], [], 0);
  assert.deepEqual(v.conclusion, { key: 'verdictRespected', tone: 'ok' });
});

test('after an acceptance, trackers are information, not faults', () => {
  const v = buildVerdict({ ...tcfReject, choice: 'accepted' }, [r('.x.it', 'Marketing', 'X')], [r('.criteo.com', 'Marketing', 'Criteo')], 0);
  assert.ok(v.items.every((i) => i.mark !== 'bad'));
  assert.equal(v.conclusion?.key, 'verdictAccepted');
});

test('no choice recorded: what is active is active without consent', () => {
  const v = buildVerdict(undefined, [], [r('.criteo.com', 'Marketing', 'Criteo')], 0);
  assert.ok(keys(v).includes('bad:itemThirdPartyNoChoice'));
  assert.equal(v.conclusion, undefined); // no conclusion about a choice that was not made
});

test('without the page\'s requests, no conclusion: reload', () => {
  const v = buildVerdict(tcfReject, [], null, 0);
  assert.deepEqual(v.conclusion, { key: 'verdictNeedReload', tone: 'muted' });
});

test('names: one per third-party site, with the platform when known', () => {
  assert.deepEqual(namesBySite([
    r('.doubleclick.net', 'Marketing', 'Google'), r('stats.g.doubleclick.net', 'Analytics', 'Google'),
    r('obs.brilliantchap.com', 'Identifier'),
  ]), ['Google (doubleclick.net)', 'brilliantchap.com']);
});

test('names: the company comes from any cookie of the site, not only the first', () => {
  assert.deepEqual(namesBySite([r('.criteo.com', 'Identifier'), r('.criteo.com', 'Marketing', 'Criteo')]),
    ['Criteo (criteo.com)']);
});

test('Firefox case: only partitioned tracker cookies: recognised here only, against a rejection, amber', () => {
  const v = buildVerdict(tcfReject, [], [r('.demdex.net', 'Marketing', 'Adobe Audience Manager', { partitioned: true })], 0);
  assert.deepEqual(keys(v), ['ok:itemTcfRecorded', 'bad:itemThirdPartyPartitioned', 'ok:itemNoSiteMarketing']);
  assert.deepEqual(v.items[1]?.names, ['Adobe Audience Manager (demdex.net)']);
  assert.deepEqual(v.conclusion, { key: 'verdictPartly', tone: 'warn' });
});

test('a site with one ordinary cookie counts across sites, even if it also has partitioned ones', () => {
  const v = buildVerdict(tcfReject, [], [
    r('.demdex.net', 'Marketing', 'Adobe', { partitioned: true }), r('.demdex.net', 'Marketing', 'Adobe'),
    r('.criteo.com', 'Marketing', 'Criteo', { partitioned: true }),
  ], 0);
  const still = v.items.find((i) => i.key === 'itemThirdPartyStill');
  const part = v.items.find((i) => i.key === 'itemThirdPartyPartitioned');
  assert.deepEqual([still?.names, part?.names], [['Adobe (demdex.net)'], ['Criteo (criteo.com)']]);
  assert.equal(v.conclusion?.tone, 'alert');
});

test('TCF rejection without the total: the item says "no purpose with consent"', () => {
  const v = buildVerdict({ ...tcfReject, purposesTotal: undefined }, [], [], 0);
  assert.equal(v.items[0]?.key, 'itemTcfRecordedNoTotal');
  assert.equal(v.conclusion?.key, 'verdictRespected');
});

// Signed in to Google (screenshots, 2 November 2026): the account cookies were the only
// "third party that can recognise you" on nvidia.com and cultura.gov.it.
const nvClick: ChoiceRecord = { site: 'nvidia.com', source: 'click', choice: 'rejected', at: 0, trigger: 'action', label: 'Rifiuta facoltativi' };

test('signed in to Google: the account cookies are information, not a fault of the site', () => {
  const v = buildVerdict(nvClick, [],
    [r('.google.com', 'Marketing', 'Google Ads', { account: 'Google' }),
      r('.google.com', 'Marketing', 'Google Ads', { account: 'Google' })], 0);
  assert.deepEqual(keys(v), ['info:itemClickOnly', 'info:itemSignedIn', 'ok:itemNoSiteMarketing']);
  assert.deepEqual(v.items[1]?.names, ['Google']);
  assert.deepEqual(v.conclusion, { key: 'verdictRespected', tone: 'ok' });
});

test('signed in, but the service also has a cookie set for everyone: that one still counts', () => {
  const v = buildVerdict(nvClick, [],
    [r('.google.com', 'Marketing', 'Google Ads', { account: 'Google' }), r('.google.com', 'Marketing', 'Google')], 0);
  assert.deepEqual(keys(v), ['info:itemClickOnly', 'bad:itemThirdPartyStill', 'info:itemSignedIn', 'ok:itemNoSiteMarketing']);
  assert.deepEqual(v.items[1]?.names, ['Google (google.com)']);
  assert.deepEqual(v.conclusion, { key: 'verdictPartly', tone: 'alert' });
});

// Adobe Experience Cloud's visitor id on the site's own domain (bahn.de, 3 November 2026).
test('a shared visitor id of the site (Adobe AMCV_, s_ecid) is information, not a fault', () => {
  const bahnClick: ChoiceRecord = { site: 'bahn.de', source: 'click', choice: 'rejected', at: 0, trigger: 'action', label: 'Accetta solo i cookie necessari' };
  const v = buildVerdict(bahnClick, [
    r('.bahn.de', 'Marketing', 'Adobe Audience Manager', { name: 'AMCV_5FA50A5953FB37E50A4C98BC%40AdobeOrg' }),
    r('.bahn.de', 'Marketing', 'Adobe Analytics', { name: 's_ecid' }),
  ], [], 0);
  assert.deepEqual(keys(v), ['info:itemClickOnly', 'ok:itemNoThirdParty', 'info:itemSiteMarketingShared']);
  assert.deepEqual(v.conclusion, { key: 'verdictRespected', tone: 'ok' });
});

test('the same id on a third party\'s domain is still a tracker', () => {
  const v = buildVerdict(tcfReject, [],
    [r('.4strokemedia.com', 'Marketing', 'Adobe Audience Manager', { name: 'AMCV_1A124673527853290A490D45%40AdobeOrg' })], 0);
  assert.ok(keys(v).includes('bad:itemThirdPartyStill'));
});

test('other marketing cookies of the site still count', () => {
  assert.equal(marketingKind(r('.x.it', 'Marketing', 'Facebook', { name: '_fbp' }), 0), 'strong');
  assert.equal(marketingKind(r('.x.it', 'Marketing', 'Adobe', { name: 'AMCV_X' }), 0), 'shared');
});
