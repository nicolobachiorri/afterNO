import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  inConsentContext, isConsentContainer,
  classifyLabel, classifyAttributes, classifyControl, isConsentContext, inConsentBanner, isChoiceMessage, choiceFromTcf, mergeChoice, TCF_PRIORITY_MS, MAX_BANNER_TEXT,
  type ChoiceRecord,
} from './choice.ts';

test('the reject labels seen in the divergence test are recognised', () => {
  for (const label of ['Rifiuta tutto', 'RIFIUTA TUTTI', 'Rifiuto', 'Non accetto',
    'Continua senza accettare →', 'CONTINUA SENZA ACCETTARE', 'Consenti solo i cookie tecnici',
    'Solo gli essenziali', 'Accetta solo i necessari', 'Reject all', 'Decline']) {
    assert.equal(classifyLabel(label), 'reject', label);
  }
});

test('accept labels are recognised, and "continua senza accettare" is not one of them', () => {
  for (const label of ['Accetta e chiudi', 'ACCETTA E CONTINUA', 'Accetto', 'Accept all', 'OK', 'Consenti tutti']) {
    assert.equal(classifyLabel(label), 'accept', label);
  }
});

test('"Rifiuta e abbonati" is a pay-or-accept wall, not a rejection', () => {
  assert.equal(classifyLabel('RIFIUTA E ABBONATI'), null);
  assert.equal(classifyLabel('Rifiuta e abbonati'), null);
});

test('other buttons and long texts are ignored', () => {
  assert.equal(classifyLabel('Personalizza'), null);
  assert.equal(classifyLabel('Opzioni cookie'), null);
  assert.equal(classifyLabel('Okay, ma questo è un intero paragrafo che parla di cookie e di molte altre cose'), null);
});

test('consent context: banner text yes, a newsletter form no', () => {
  assert.equal(isConsentContext('Usiamo i cookie e i nostri 1232 partner'), true);
  assert.equal(isConsentContext('Iscriviti alla newsletter settimanale'), false);
});

test('banner check: the word may be a few levels up, as long as the text stays short', () => {
  assert.equal(inConsentBanner(['Rifiuta tutto Accetta', 'Usiamo i cookie... Rifiuta tutto Accetta']), true);
});

test('banner check: a "privacy" link somewhere in the whole page does not count', () => {
  const page = 'x'.repeat(MAX_BANNER_TEXT + 1) + ' privacy';
  assert.equal(inConsentBanner(['OK', 'Iscriviti alla newsletter OK', page]), false);
});

const tcf = (consents: Record<string, boolean>, eventStatus = 'useractioncomplete') => ({
  gdprApplies: true, eventStatus,
  purpose: { consents, legitimateInterests: { 2: true, 7: true, 9: false } },
  vendor: { consents: { 10: true, 21: false, 32: true } },
});

test('TCF: no purpose consented is a rejection, with legitimate interests counted', () => {
  const r = choiceFromTcf(tcf({ 1: false, 2: false, 3: false }), 'ilmeteo.it', 1000);
  assert.equal(r?.choice, 'rejected');
  assert.equal(r?.purposesConsented, 0);
  assert.equal(r?.purposesTotal, 3);
  assert.equal(r?.legitimateInterests, 2);
  assert.deepEqual(r?.legitimatePurposes, [2, 7]);
  assert.equal(r?.vendorsConsented, 2);
});

test('TCF: all purposes is acceptance, some is partial', () => {
  assert.equal(choiceFromTcf(tcf({ 1: true, 2: true }), 's.it', 0)?.choice, 'accepted');
  assert.equal(choiceFromTcf(tcf({ 1: true, 2: false }), 's.it', 0)?.choice, 'partial');
});

test('TCF: a stored choice on page load counts, an open banner does not', () => {
  assert.equal(choiceFromTcf(tcf({ 1: false }, 'tcloaded'), 's.it', 0)?.choice, 'rejected');
  assert.equal(choiceFromTcf(tcf({ 1: false }, 'cmpuishown'), 's.it', 0), null);
});

test('TCF: nothing when GDPR does not apply or purposes are missing', () => {
  assert.equal(choiceFromTcf({ gdprApplies: false, eventStatus: 'tcloaded' }, 's.it', 0), null);
  assert.equal(choiceFromTcf({ gdprApplies: true, eventStatus: 'tcloaded', purpose: {} }, 's.it', 0), null);
});

const rec = (source: 'tcf' | 'click', at: number, site = 's.it'): ChoiceRecord =>
  ({ site, source, choice: source === 'tcf' ? 'rejected' : 'accepted', at, trigger: 'action' });

test('merge: TCF always wins over a click', () => {
  assert.equal(mergeChoice(rec('click', 0), rec('tcf', 10)).source, 'tcf');
});

test('merge: a click right after a TCF record does not replace it', () => {
  assert.equal(mergeChoice(rec('tcf', 0), rec('click', TCF_PRIORITY_MS - 1)).source, 'tcf');
});

test('merge: a later click replaces an old TCF record', () => {
  assert.equal(mergeChoice(rec('tcf', 0), rec('click', TCF_PRIORITY_MS)).source, 'click');
});

test('merge: records of another site are replaced', () => {
  assert.equal(mergeChoice(rec('tcf', 0, 'a.it'), rec('click', 1, 'b.it')).site, 'b.it');
});

test('message check: valid messages pass, odd ones do not', () => {
  const ok = { type: 'choice', record: { source: 'click', choice: 'rejected', at: 1, trigger: 'action', label: 'Rifiuta' } };
  assert.equal(isChoiceMessage(ok), true);
  assert.equal(isChoiceMessage({ ...ok, type: 'other' }), false);
  assert.equal(isChoiceMessage({ type: 'choice', record: { ...ok.record, choice: 'maybe' } }), false);
  assert.equal(isChoiceMessage({ type: 'choice', record: { ...ok.record, label: 'x'.repeat(51) } }), false);
  assert.equal(isChoiceMessage(null), false);
});

// ---------------------------------------------------------------- real data
// The button texts recorded by the divergence test, classified by hand.
// Every change to the rules must keep all of them right, the 210 that are not a
// choice included: those protect against false "after your rejection" claims.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/step1-buttons.json', import.meta.url), 'utf8')) as {
  cases: { label: string; expected: 'reject' | 'accept' | null }[];
};

test('real button texts from step 1: every one classified as expected', () => {
  const wrong = fixture.cases.filter((c) => classifyLabel(c.label) !== c.expected)
    .map((c) => `${c.label} -> ${classifyLabel(c.label)} (expected ${c.expected})`);
  assert.deepEqual(wrong, []);
  assert.ok(fixture.cases.length > 200);
});

test('other languages: reject', () => {
  for (const label of ['Tout refuser', 'Refuser', 'Continuer sans accepter', 'Alle ablehnen',
    'Ablehnen', 'Nur notwendige', 'Rechazar todo', 'Rechazar', 'Only essential', 'Continue without accepting']) {
    assert.equal(classifyLabel(label), 'reject', label);
  }
});

test('other languages: accept', () => {
  for (const label of ['Tout accepter', "J'accepte", 'Alle akzeptieren', 'Akzeptieren', 'Zustimmen',
    'Aceptar', 'Aceptar todo', 'Allow all', 'I agree', 'I accept']) {
    assert.equal(classifyLabel(label), 'accept', label);
  }
});

test('stems do not catch unrelated words', () => {
  for (const label of ['Negozi', 'Accedi', 'Accessori', 'Okay']) assert.equal(classifyLabel(label), null, label);
});

test('consent platform attributes', () => {
  const cases: [string, 'reject' | 'accept'][] = [
    ['onetrust-reject-all-handler', 'reject'], ['onetrust-accept-btn-handler', 'accept'],
    ['CybotCookiebotDialogBodyButtonDecline', 'reject'],
    ['CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', 'accept'],
    ['didomi-components-button didomi-notice-disagree-button', 'reject'],
    ['didomi-notice-agree-button', 'accept'],
    ['iubenda-cs-reject-btn', 'reject'], ['iubenda-cs-accept-btn', 'accept'],
    ['uc-deny-all-button', 'reject'], ['uc-accept-all-button', 'accept'],
    ['message-component message-button sp_choice_type_13', 'reject'],
    ['message-component message-button sp_choice_type_11', 'accept'],
  ];
  for (const [attrs, expected] of cases) assert.equal(classifyAttributes(attrs), expected, attrs);
  assert.equal(classifyAttributes('onetrust-pc-btn-handler cookie-setting-link'), null);
  assert.equal(classifyAttributes('sp_choice_type_12'), null); // "options": not a choice
});

test('text and attributes: either alone is enough, a disagreement claims nothing', () => {
  assert.equal(classifyControl('', 'onetrust-reject-all-handler'), 'reject'); // icon button, no text
  assert.equal(classifyControl('Rifiutare', 'btn btn-primary'), 'reject');
  assert.equal(classifyControl('Accetta', 'consent-reject-button'), null);
});

test('a paying label wins over a reject attribute', () => {
  assert.equal(classifyControl('Rifiuta e abbonati', 'cmp-reject-btn'), null);
});

test('TCF trigger: a user action vs a choice stored earlier', () => {
  assert.equal(choiceFromTcf(tcf({ 1: false }), 's.it', 0)?.trigger, 'action');
  assert.equal(choiceFromTcf(tcf({ 1: false }, 'tcloaded'), 's.it', 0)?.trigger, 'stored');
});

test('merge: a stored choice reported on reload keeps the time of the real choice', () => {
  const real: ChoiceRecord = { site: 's.it', source: 'tcf', choice: 'rejected', at: 1000, trigger: 'action' };
  const reload: ChoiceRecord = { ...real, at: 99_000, trigger: 'stored' };
  const merged = mergeChoice(real, reload);
  assert.equal(merged.at, 1000);
  assert.equal(merged.trigger, 'action');
});

test('merge: a different stored choice replaces the old one', () => {
  const old: ChoiceRecord = { site: 's.it', source: 'tcf', choice: 'rejected', at: 1000, trigger: 'action' };
  const changed: ChoiceRecord = { ...old, choice: 'accepted', at: 99_000, trigger: 'stored' };
  assert.equal(mergeChoice(old, changed).choice, 'accepted');
});

test('message check: the trigger is required', () => {
  assert.equal(isChoiceMessage({ type: 'choice', record: { source: 'click', choice: 'rejected', at: 1 } }), false);
});

test('TCF listing only the purposes with consent: empty after an action is a rejection, total unknown', () => {
  const r = choiceFromTcf({ gdprApplies: true, eventStatus: 'useractioncomplete', purpose: { consents: {} } }, 'subito.it', 5);
  assert.equal(r?.choice, 'rejected');
  assert.equal(r?.purposesTotal, undefined);
  assert.equal(r?.trigger, 'action');
});

test('TCF empty list on load: a rejection only if a choice is stored (tcString), otherwise nothing', () => {
  assert.equal(choiceFromTcf({ eventStatus: 'tcloaded', purpose: { consents: {} }, tcString: 'CP...' }, 's.it', 1)?.choice, 'rejected');
  assert.equal(choiceFromTcf({ eventStatus: 'tcloaded', purpose: { consents: {} } }, 's.it', 1), null);
  assert.equal(choiceFromTcf({ eventStatus: 'cmpuishown', purpose: { consents: {} } }, 's.it', 1), null);
});

test('Didomi "continue without agreeing": text and attributes agree on a rejection', () => {
  assert.equal(classifyControl('Continua senza accettare →', 'didomi-continue-without-agreeing'), 'reject');
  assert.equal(classifyControl('Accetta', 'didomi-notice-agree-button'), 'accept');
});

test('Cookiebot: the dialog is named as such, even if its text (the list of cookies) is long', () => {
  const texts = ['Rifiuta tutti Accetta', 'x'.repeat(68_000)];
  const names = [' CybotCookiebotDialogBodyButtonsWrapper', ' CybotEdge CybotCookiebotDialogActive'];
  assert.equal(inConsentContext(texts, names), true);
  assert.equal(inConsentContext(texts, [' btn-group', ' modal-footer']), false); // no name, too long
});

test('container names: consent platforms yes, ordinary layout no', () => {
  for (const n of ['cookieman-modal modal fade show', 'ccc ', 'onetrust-banner-sdk', 'didomi-popup', 'iubenda-cs-banner'])
    assert.equal(isConsentContainer(n), true, n);
  for (const n of ['newsletter-box', 'footer links', 'modal-content', 'accordion'])
    assert.equal(isConsentContainer(n), false, n);
});
