// What did the user choose in the cookie banner?
// Two sources, in order of reliability:
//   1. TCF: sites using the IAB Transparency & Consent Framework expose the consent
//      state, purpose by purpose. It is what the consent platform tells the trackers.
//   2. Click: on other sites, the label of the button the user clicked in the banner.
// Everything here is pure (no browser calls), so it is unit-tested with plain Node.

export type Choice = 'rejected' | 'accepted' | 'partial';

export interface ChoiceRecord {
  site: string; // registrable domain of the page, e.g. "ilmeteo.it"
  source: 'tcf' | 'click';
  choice: Choice;
  at: number; // milliseconds since the epoch
  label?: string; // click only: the button text, at most 50 characters
  purposesConsented?: number; // TCF only
  purposesTotal?: number;
  legitimateInterests?: number; // TCF purposes still active on "legitimate interest"
  vendorsConsented?: number;
}

// Message from the content script to the background. The background adds the site
// from the tab's URL: a banner may live in an iframe of another domain.
export interface ChoiceMessage {
  type: 'choice';
  record: Omit<ChoiceRecord, 'site'>;
}

// Messages are checked before use. Only the extension's own scripts can send them,
// but a content script runs next to the page, so the background trusts the shape
// of the data no more than it has to.
export function isChoiceMessage(x: unknown): x is ChoiceMessage {
  const m = x as ChoiceMessage | null;
  const r = m?.record;
  return m?.type === 'choice' && !!r
    && (r.source === 'tcf' || r.source === 'click')
    && (r.choice === 'rejected' || r.choice === 'accepted' || r.choice === 'partial')
    && typeof r.at === 'number'
    && (r.label === undefined || (typeof r.label === 'string' && r.label.length <= 50));
}

// ------------------------------------------------------------------ button labels
// Word stems rather than whole words ("rifiut" covers rifiuta, rifiutare, rifiuto),
// plus the main formulas in English, French, German and Spanish. Anchored at the start
// of the label, so that "Accetta" cannot match "Non accetto".
// The aim is precision: a missed rejection shows "no choice recorded", a wrong one
// would make the popup say "after your rejection" when there was none.
const REJECT = new RegExp(
  '^\\s*('
  // Italian
  + 'rifiut|nega(re)?\\b|nega il|non accett|non acconsent|(continua|prosegui) senza accettare|'
  + '(accetta |consenti |usa |continua con )?solo (i |gli |le )?(cookie )?(strettamente )?(necessari|essenziali|tecnici)|'
  // English
  + 'reject|decline|deny|disagree|refuse|only (necessary|essential|required)|(necessary|essential) only|'
  + 'use (only )?necessary|continue without accepting|'
  // French, German, Spanish
  + '(tout )?refuser|continuer sans accepter|(alle )?ablehnen|nur (notwendige|erforderliche)|'
  + 'rechazar|solo (las )?(necesarias|esenciales)'
  + ')',
  'i',
);
// "Rifiuta e abbonati" opens a subscription: it is a pay-or-accept wall, not a rejection.
const PAYWALL = /abbona|subscri|paga|acquista|premium|abonn|abonnier|suscrib/i;
const ACCEPT = new RegExp(
  '^\\s*('
  + 'accett|acconsent|consenti (tutt|i cookie)|va bene|ho capito|ok\\b|'
  + '(i )?accept|(i )?agree|allow (all|cookies)|got it|'
  + "j'accepte|tout accepter|akzeptieren|alle (akzeptieren|annehmen|zulassen)|zustimmen|einverstanden|"
  + 'acept'
  + ')',
  'i',
);

export type LabelKind = 'reject' | 'accept';

export function classifyLabel(label: string): LabelKind | null {
  const text = label.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 60) return null; // a paragraph, not a button
  if (PAYWALL.test(text)) return null;
  if (REJECT.test(text)) return 'reject'; // checked first: "continua senza accettare"
  if (ACCEPT.test(text)) return 'accept';
  return null;
}

// Consent platforms give their buttons stable internal names, which change far less
// often than the visible text: onetrust-reject-all-handler (OneTrust),
// CybotCookiebotDialogBodyButtonDecline (Cookiebot), didomi-notice-disagree-button
// (Didomi), iubenda-cs-reject-btn (iubenda), uc-deny-all-button (Usercentrics).
// Sourcepoint uses numbered classes: sp_choice_type_11 is "accept all", 13 "reject all".
// "disagree" contains "agree", so the reject words are checked first.
const ATTR_REJECT = /reject|decline|deny|disagree|refuse|opt-?out|necessary-?only|only-?necessary|sp_choice_type_13\b/i;
const ATTR_ACCEPT = /accept|agree|allow-?all|opt-?in|sp_choice_type_11\b/i;

export function classifyAttributes(attrs: string): LabelKind | null {
  if (ATTR_REJECT.test(attrs)) return 'reject';
  if (ATTR_ACCEPT.test(attrs)) return 'accept';
  return null;
}

// Text and attributes together. When they disagree, nothing is claimed: precision first.
// A label about paying or subscribing wins over everything, whatever the attributes say.
export function classifyControl(label: string, attrs: string): LabelKind | null {
  if (PAYWALL.test(label)) return null;
  const byText = classifyLabel(label);
  const byAttrs = classifyAttributes(attrs);
  if (byText && byAttrs && byText !== byAttrs) return null;
  return byText ?? byAttrs;
}

// The clicked button must sit inside something that talks about cookies or consent,
// otherwise an "Accetta" in a newsletter form would count as a cookie choice.
export function isConsentContext(text: string): boolean {
  return /cookie|consens|consent|privacy|gdpr|partner|tracciament|tracking/i.test(text);
}

// A banner is short; a whole page is long. Walking up from the button, we only look
// at containers whose text stays under this length, so that a "privacy" link in the
// page footer cannot turn any "OK" button into a cookie choice.
export const MAX_BANNER_TEXT = 3000;

export function inConsentBanner(ancestorTexts: string[]): boolean {
  for (const text of ancestorTexts) {
    if (text.length > MAX_BANNER_TEXT) return false; // left the banner: stop
    if (isConsentContext(text)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ TCF data
// The parts of the TCF "tcData" object we read (see the IAB TCF v2 specification).
export interface TcData {
  gdprApplies?: boolean;
  eventStatus?: string; // 'tcloaded' | 'cmpuishown' | 'useractioncomplete'
  purpose?: {
    consents?: Record<string, boolean>;
    legitimateInterests?: Record<string, boolean>;
  };
  vendor?: { consents?: Record<string, boolean> };
}

const countTrue = (o?: Record<string, boolean>) => Object.values(o ?? {}).filter(Boolean).length;

// Returns null when the data says nothing about a choice: the banner is still open
// ('cmpuishown'), GDPR does not apply, or the purposes are missing.
export function choiceFromTcf(data: TcData, site: string, at: number): ChoiceRecord | null {
  if (data.gdprApplies === false) return null;
  if (data.eventStatus !== 'tcloaded' && data.eventStatus !== 'useractioncomplete') return null;
  const consents = data.purpose?.consents;
  if (!consents || Object.keys(consents).length === 0) return null;
  const total = Object.keys(consents).length;
  const given = countTrue(consents);
  const choice: Choice = given === 0 ? 'rejected' : given === total ? 'accepted' : 'partial';
  return {
    site, source: 'tcf', choice, at,
    purposesConsented: given,
    purposesTotal: total,
    legitimateInterests: countTrue(data.purpose?.legitimateInterests),
    vendorsConsented: countTrue(data.vendor?.consents),
  };
}

// ------------------------------------------------------------------ merging
// Which record wins when a new one arrives for the same site?
// TCF always wins: it is the consent state itself. A click replaces a TCF record
// only when the TCF one is older than a minute (a later, different choice).
export const TCF_PRIORITY_MS = 60_000;

export function mergeChoice(existing: ChoiceRecord | undefined, incoming: ChoiceRecord): ChoiceRecord {
  if (!existing || existing.site !== incoming.site) return incoming;
  if (incoming.source === 'tcf') return incoming;
  if (existing.source === 'tcf' && incoming.at - existing.at < TCF_PRIORITY_MS) return existing;
  return incoming;
}
