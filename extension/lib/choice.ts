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
  // 'action': the user just chose (a click, or TCF "useractioncomplete").
  // 'stored': a choice made earlier, reported again on page load (TCF "tcloaded").
  trigger: 'action' | 'stored';
  label?: string; // click only: the button text, at most 50 characters
  purposesConsented?: number; // TCF only
  purposesTotal?: number;
  legitimateInterests?: number; // TCF purposes still active on "legitimate interest"
  legitimatePurposes?: number[]; // which ones (TCF purpose ids, 1-11)
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
    && (r.trigger === 'action' || r.trigger === 'stored')
    && (r.label === undefined || (typeof r.label === 'string' && r.label.length <= 50));
}

// ------------------------------------------------------------------ button labels
// Word stems rather than whole words ("rifiut" covers rifiuta, rifiutare, rifiuto),
// plus the main formulas in English, French, German, Spanish, Portuguese, Dutch and
// Polish (3 November 2026: the extension is for browsing in the EU). Anchored at the
// start of the label, so that "Accetta" cannot match "Non accetto".
// The same words, in Python, are in quality/robot_labels.py for the measurement robot.
// The aim is precision: a missed rejection shows "no choice recorded", a wrong one
// would make the popup say "after your rejection" when there was none.
// tarteaucitron names its buttons "Cookies : Deny all cookies" (idonate.ie, sample F):
// the name of an icon-only button may start with "Cookies :".
const REJECT = new RegExp(
  '^\\s*(cookies?\\s*:\\s*)?('
  // Italian
  + 'rifiut|nega(re)?\\b|nega il|non accett|non acconsent|(continua|prosegui) senza accettare|no,? grazie|'
  + '(accetta |consenti |usa |continua con )?solo (i |gli |le )?(cookie )?(strettamente )?(necessari|essenziali|tecnici)|'
  // English
  + '(i )?(reject|decline|deny|disagree|refuse|do not (accept|agree)|don.?t (accept|agree))|no,? thanks|only (necessary|essential|required)|(necessary|essential) only|'
  + 'use (only )?necessary|continue without accepting|'
  // French
  + '(tout |je )?refuser?( tout)?|continuer sans accepter|je n.?accepte pas|non,? merci|'
  + '(accepter |autoriser )?(uniquement|seulement) (les )?(cookies )?(strictement )?(n[eé]cessaires|essentiels)|(cookies )?(strictement )?(n[eé]cessaires|essentiels) (uniquement|seulement)|'
  // German
  + '((alle|optionale|nicht notwendige)( [a-zäöüß-]+)? )?(cookies )?ablehnen|nicht (akzeptieren|zustimmen)|nein,? danke|'
  + 'nur (technisch )?(notwendige|erforderliche|essenzielle|essentielle)|weiter ohne (zu )?(einwilligung|zustimmung|akzeptieren)|'
  // Spanish
  + 'rechazar|no acepto|continuar sin aceptar|no,? gracias|'
  + '(aceptar |permitir )?(solo|sólo|únicamente) (las )?(cookies )?(necesarias|esenciales|t[eé]cnicas)|'
  // Portuguese
  + 'rejeitar|recusar|continuar sem aceitar|n[aã]o aceito|n[aã]o,? obrigad[oa]|(aceitar )?(apenas|somente) (os )?(cookies )?(necess[aá]rios|essenciais)|'
  // Dutch
  + '(alles |alle cookies )?(weigeren|afwijzen)|(accepteer |sta )?alleen (noodzakelijke|functionele|essenti[eë]le)|nee,? bedankt|niet akkoord|'
  // Polish
  + 'odrzu[cć]|odmawiam|odm[oó]w|nie zgadzam si[eę]|nie akceptuj[eę]|((za)?akceptuj |zezw[oó]l na )?tylko (niezb[eę]dne|wymagane)'
  + ')',
  'i',
);
// "Rifiuta e abbonati" opens a subscription: it is a pay-or-accept wall, not a rejection.
const PAYWALL = /abbona|subscri|paga|acquista|premium|abonn|abonnier|abo\b|suscri|assin|bezahl|betal|subskry|prenumer/i;
const ACCEPT = new RegExp(
  '^\\s*(cookies?\\s*:\\s*)?('
  + 'accett|acconsent|consenti (tutt|i cookie)|va bene|ho capito|ok\\b|'
  + '(i )?accept|(i )?agree|allow (all|cookies)|got it|'
  + "j'accepte|tout accepter|autoriser (tous|tout)|d'accord|"
  + 'akzeptieren|alle( [a-zäöüß-]+)? (akzeptieren|annehmen|zulassen|erlauben)|annehmen|zustimmen|einverstanden|'
  + 'acept|permitir (todas|todo)|aceit|concordo|permitir todos|'
  + 'accepteren|alles accepteren|akkoord|toestaan|'
  + 'akceptuj|zaakceptuj|zgadzam|zgoda'
  + ')',
  'i',
);

export type LabelKind = 'reject' | 'accept';

// A label that also talks about changing or managing opens the settings: it is not a
// choice yet. «ablehnen, ändern oder widerrufen» (kleinanzeigen.de, sample F) starts
// like a rejection but leads to a second layer; «Einstellungen oder ablehnen» too.
const SETTINGS = /ändern|einstellungen|anpassen|verwalten|\bmanage|settings|customi[sz]e|preferences|gestisci|personalizza|impostazioni|modifica|param[eé]tr|personnalis|g[eé]rer|configur|gestionar|personaliz|gerir|aanpassen|instellen|instellingen|beheren|zarz[aą]dzaj|ustawieni|dostosuj/i;

export function classifyLabel(label: string): LabelKind | null {
  const text = label.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 60) return null; // a paragraph, not a button
  if (PAYWALL.test(text)) return null;
  if (SETTINGS.test(text)) return null;
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
// Checked before ATTR_ACCEPT: "continue-without-agreeing" (Didomi) contains "agree" but means the opposite,
// and so does "js-accept-essential-cookies" (bahn.de, 3 November 2026): accept only the essential ones.
const ATTR_REJECT = /reject|decline|deny|disagree|refuse|opt-?out|(necessary|essential|required)-?only|only-?(necessary|essential|required)|(accept|allow|save)-?(only-?)?(necessary|essential|required)|continue-?without|without-?(agree|accept|consent)|sp_choice_type_13\b/i;
const ATTR_ACCEPT = /accept|agree|allow-?all|opt-?in|sp_choice_type_11\b/i;

export function classifyAttributes(attrs: string): LabelKind | null {
  if (ATTR_REJECT.test(attrs)) return 'reject';
  if (ATTR_ACCEPT.test(attrs)) return 'accept';
  return null;
}

// Text and attributes together. When they disagree, nothing is claimed: precision first.
// A label about paying or subscribing wins over everything, whatever the attributes say.
// "Save settings" is neither: it saves whatever the toggles say. Some platforms
// still name it "accept" internally (meduniwien.ac.at: «Alle Dienste ablehnen» turns
// the toggles off and then clicks «Einstellungen speichern» by itself, and that second
// click overwrote the rejection with an acceptance). A save button counts only when
// its internal name says reject, as in "save-necessary".
const SAVE = /^\s*((einstellungen|auswahl|meine auswahl|preferences|settings|selection|my choices|impostazioni|scelte|preferenze|selezione|choix|préférences|paramètres|configuración|preferencias|selección|preferências|seleção|instellingen|voorkeuren|keuze|ustawienia|wybór)\s+)?(speichern|bestätigen|save|confirm|salva|conferma|enregistrer|valider|confirmer|guardar|confirmar|opslaan|bevestigen|zapisz|potwierd)/i;

export function classifyControl(label: string, attrs: string): LabelKind | null {
  if (PAYWALL.test(label)) return null;
  const byText = classifyLabel(label);
  const byAttrs = classifyAttributes(attrs);
  if (!byText && SAVE.test(label)) return byAttrs === 'reject' ? 'reject' : null;
  if (byText && byAttrs && byText !== byAttrs) return null;
  return byText ?? byAttrs;
}

// The clicked button must sit inside something that talks about cookies or consent,
// otherwise an "Accetta" in a newsletter form would count as a cookie choice.
// Words for "consent" and "data protection" in the same eight languages: a banner
// that says "Einwilligung" or "Datenschutz" without the word "cookie" still counts.
export function isConsentContext(text: string): boolean {
  return /cookie|consens|consent|privacy|gdpr|rgpd|dsgvo|partner|tracciament|tracking|datenschutz|einwilligung|zustimmung|donn[eé]es personnelles|vie priv[eé]e|privacidad|datos personales|privacidade|dados pessoais|toestemming|gegevens|prywatno|zgod/i.test(text);
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

// Consent platforms name their containers: CybotCookiebotDialog (Cookiebot),
// cookieman-modal, ccc (Civic), onetrust-banner-sdk, didomi-popup, iubenda-cs-banner...
// Such a name says "this is the banner" even when its text is long: Cookiebot puts
// the whole list of cookies inside its dialog, far over MAX_BANNER_TEXT.
// The caller stops before <body> and <html>: some sites mark the whole page while the
// banner is open (body class="cookie-banner-open"), and that must not turn any button
// of the page into a consent choice.
const CONSENT_CONTAINER = /cookie|consent|gdpr|\bcmp|cybot|onetrust|didomi|iubenda|usercentrics|cookieyes|klaro|tarteaucitron|quantcast|sp_message|\bccc\b/i;

export function isConsentContainer(idAndClass: string): boolean {
  return CONSENT_CONTAINER.test(idAndClass);
}

// Either test is enough: a short container that talks about cookies, or a container
// a consent platform named as its own.
export function inConsentContext(ancestorTexts: string[], ancestorNames: string[]): boolean {
  return inConsentBanner(ancestorTexts) || ancestorNames.some(isConsentContainer);
}

// Longest text that can still be a button label. Also used by the content script for
// a clicked element that is not a button but a short text ("Continua senza accettare"
// in a clickable <span>, agriturismo.it).
export const MAX_LABEL = 60;

// ------------------------------------------------------------------ TCF data
// The parts of the TCF "tcData" object we read (see the IAB TCF v2 specification).
export interface TcData {
  gdprApplies?: boolean;
  tcString?: string; // present once a choice has been stored
  eventStatus?: string; // 'tcloaded' | 'cmpuishown' | 'useractioncomplete'
  purpose?: {
    consents?: Record<string, boolean>;
    legitimateInterests?: Record<string, boolean>;
  };
  vendor?: { consents?: Record<string, boolean> };
}

const countTrue = (o?: Record<string, boolean>) => Object.values(o ?? {}).filter(Boolean).length;
const trueIds = (o?: Record<string, boolean>) =>
  Object.entries(o ?? {}).filter(([, v]) => v).map(([k]) => Number(k)).filter(Number.isInteger).sort((a, b) => a - b);

// Returns null when the data says nothing about a choice: the banner is still open
// ('cmpuishown'), GDPR does not apply, or the purposes are missing.
export function choiceFromTcf(data: TcData, site: string, at: number): ChoiceRecord | null {
  if (data.gdprApplies === false) return null;
  if (data.eventStatus !== 'tcloaded' && data.eventStatus !== 'useractioncomplete') return null;
  const consents = data.purpose?.consents;
  const trigger = data.eventStatus === 'useractioncomplete' ? 'action' : 'stored';
  if (!consents || Object.keys(consents).length === 0) {
    // The standard lets a platform list every purpose (true or false) or only those
    // WITH consent. In the second form, an empty list once a choice exists (the user
    // just acted, or a stored choice is loaded) means: no consent at all. The total
    // is then unknown, and left out rather than guessed.
    if (trigger === 'stored' && !data.tcString) return null;
    return {
      site, source: 'tcf', choice: 'rejected', at, trigger, purposesConsented: 0,
      legitimateInterests: countTrue(data.purpose?.legitimateInterests),
    legitimatePurposes: trueIds(data.purpose?.legitimateInterests),
      vendorsConsented: countTrue(data.vendor?.consents),
    };
  }
  const total = Object.keys(consents).length;
  const given = countTrue(consents);
  const choice: Choice = given === 0 ? 'rejected' : given === total ? 'accepted' : 'partial';
  return {
    site, source: 'tcf', choice, at,
    trigger,
    purposesConsented: given,
    purposesTotal: total,
    legitimateInterests: countTrue(data.purpose?.legitimateInterests),
    legitimatePurposes: trueIds(data.purpose?.legitimateInterests),
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
  // A stored choice reported again on reload keeps the time of the real choice.
  if (incoming.trigger === 'stored' && existing.choice === incoming.choice) {
    return { ...incoming, at: existing.at, trigger: existing.trigger };
  }
  if (incoming.source === 'tcf') return incoming;
  if (existing.source === 'tcf' && incoming.at - existing.at < TCF_PRIORITY_MS) return existing;
  return incoming;
}
