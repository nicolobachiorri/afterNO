// Popup: the choice made in the banner, a summary and the comparison with the moment
// of the choice, then the cookies the trackers can read, then the site's own.
// This is the thin, browser-facing layer: read data, call the functions in lib/,
// display the result. The rules live in lib/ and are unit-tested.
import './style.css';
import { browser } from 'wxt/browser';
import { type ChoiceRecord } from '@/lib/choice';
import { loadDb, loadDescriptions, observe } from '@/lib/cookies';
import { describe, firstSentence, type DescriptionDb } from '@/lib/describe';
import { siteOf } from '@/lib/hosts';
import { MIN_IDENTIFIER_DAYS } from '@/lib/identifiers';
import { pluralKey } from '@/lib/plural';
import { hostsSince, type Classified, type Snapshot } from '@/lib/snapshot';
import { RECOGNISING, summarise, type Group, type Summary } from '@/lib/summary';
import { buildVerdict, marketingKind, type Item } from '@/lib/verdict';
import { choiceKey, readTabHosts, snapshotKey, tabKey } from '@/lib/tabstore';

// Every text comes from public/_locales/<language>/messages.json, chosen by the browser
// from the user's language. The cast keeps this file independent of the message-key
// types WXT generates, which are only refreshed when the dev server runs.
const getMessage = browser.i18n.getMessage as (key: string, substitutions?: string[]) => string;
const t = (key: string, ...subs: (string | number)[]): string => getMessage(key, subs.map(String)) || key;
const tn = (base: string, n: number, ...subs: (string | number)[]): string =>
  t(pluralKey(base, n, browser.i18n.getUILanguage()), n, ...subs);
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString(browser.i18n.getUILanguage(), { hour: '2-digit', minute: '2-digit' });

// Order of the groups: what can recognise the user first.
const ORDER: Group[] = [
  'Marketing', 'Analytics', 'Identifier', 'Unknown', 'Personalization',
  'Preferences', 'Functional', 'Necessary', 'Security',
];

// Small helper to build DOM nodes. Cookie names come from websites, so they are
// untrusted: they are always inserted as text (textContent), never as HTML.
function h(tag: string, props: { class?: string; text?: string } = {}, ...children: Node[]): HTMLElement {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  el.append(...children);
  return el;
}

function formatExpiry(c: Classified): string {
  if (c.session || c.expirationDate === undefined) return t('expirySession');
  const days = Math.round((c.expirationDate * 1000 - Date.now()) / 86_400_000);
  if (days < 1) return t('expiryUnderDay');
  if (days < 60) return tn('expiryDays', days);
  return tn('expiryMonths', Math.round(days / 30));
}

async function fromSession<T>(key: string): Promise<T | undefined> {
  return (await browser.storage.session.get(key))[key] as T | undefined;
}

// ------------------------------------------------------------------ cookie lists

// For the site's own marketing cookies, the same distinction the checklist makes
// (lib/verdict.ts): the platform's cookie on its own site, or a short-lived one, is
// shown with a short note and does not make the group look alarming.
// Not for the trackers' cookies: there the owner IS the tracker, so "own" would hide it.
type Side = 'own' | 'trackers';

// A tracker's partitioned cookie: said under the cookie, but still a tracker's cookie,
// so it does not make the group look less alarming.
function partitionNote(r: Classified, side: Side): HTMLElement[] {
  return side === 'trackers' && r.partitioned ? [h('span', { class: 'soft', text: t('notePartitioned') })] : [];
}

// A cookie of the user's own account (signed in to Google...): it exists because the
// user is signed in, not because of this site. Same rule as the checklist.
function accountNote(r: Classified, side: Side): HTMLElement[] {
  return side === 'trackers' && r.account ? [h('span', { class: 'soft', text: t('noteAccount', r.account) })] : [];
}

function softNote(r: Classified, side: Side, nowMs: number): string | undefined {
  if (side !== 'own' || r.group !== 'Marketing') return undefined;
  const kind = marketingKind(r, nowMs);
  return kind === 'own' ? t('noteOwnPlatform') : kind === 'short' ? t('noteShortLived') : undefined;
}

// The descriptions exist only in English. In another language they are shown as they
// are, marked "ENG:", rather than hidden or machine-translated.
let descDb: DescriptionDb = { exact: {}, prefixes: [] };

// The text is what someone declared (often copied from a privacy policy, sometimes
// in the first person: "our website", "we do not..."). So it is shown as a quote with
// its source, never as our own statement. First sentence only; the rest on request.
// Only for a cookie the classification recognised: an "unknown" or "likely identifier"
// cookie may share its name with a known one (a generic name off the platform's site,
// see isGenericName), and the known one's description would then be wrong.
function description(r: Classified): HTMLElement[] {
  if (r.group === 'Unknown' || r.group === 'Identifier') return [];
  const text = describe(r.name, descDb);
  if (!text) return [];
  const { first, rest } = firstSentence(text);
  const quote = h('q', { text: first });
  quote.lang = 'en'; // screen readers pronounce it as English
  const box = h('span', { class: 'desc' }, h('span', { class: 'source', text: `${t('descSource')} ` }), quote);
  if (rest) {
    const more = h('button', { class: 'more', text: t('descMore') }) as HTMLButtonElement;
    more.type = 'button';
    more.addEventListener('click', () => {
      quote.textContent = text;
      more.remove();
    });
    box.append(' ', more);
  }
  return [box];
}

// One collapsible group. Groups that can recognise the user start open, unless every
// cookie in them carries one of the notes above.
function groupBlock(group: Group, rows: Classified[], side: Side, nowMs: number): HTMLElement {
  const items = rows
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name))
    .map((r) => h('li', {},
      h('span', { class: 'name', text: r.name }),
      h('span', { class: 'meta', text: [r.platform, r.domain, formatExpiry(r)].filter(Boolean).join(' · ') }),
      ...description(r),
      ...partitionNote(r, side),
      ...accountNote(r, side),
      ...[softNote(r, side, nowMs)].filter((n): n is string => !!n).map((n) => h('span', { class: 'soft', text: n })),
    ));
  const alarming = RECOGNISING.has(group) && rows.some((r) => !softNote(r, side, nowMs) && !(side === 'trackers' && r.account));
  const details = h('details', { class: `group ${alarming ? 'tracking' : ''}` },
    h('summary', { text: `${t(`group_${group}`)} (${rows.length})` }),
    // What this kind of cookie is for, in plain words.
    h('p', { class: 'note', text: group === 'Identifier' ? t('groupNote_Identifier', MIN_IDENTIFIER_DAYS) : t(`groupExplain_${group}`) }),
    h('ul', {}, ...items),
  ) as HTMLDetailsElement;
  details.open = alarming;
  return details;
}

function groups(rows: Classified[], side: Side): HTMLElement[] {
  const nowMs = Date.now();
  return ORDER
    .map((g) => [g, rows.filter((r) => r.group === g)] as const)
    .filter(([, rs]) => rs.length > 0)
    .map(([g, rs]) => groupBlock(g, [...rs], side, nowMs));
}

// ------------------------------------------------------------------ summary

// Two columns: at the moment of the choice (everything there appeared before consent
// or refusal) and now (only trackers contacted after the choice).
function comparison(before: Summary, now: Summary, at: number): HTMLElement {
  const row = (label: string, a: number, b: number) =>
    h('tr', {}, h('th', { text: label }), h('td', { text: String(a) }), h('td', { text: String(b) }));
  const total = (s: Summary, k: 'marketing' | 'analytics') => s[k].site + s[k].trackers;
  return h('section', { class: 'compare' },
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}),
        h('th', { text: t('compareAtChoice', clock(at)) }), h('th', { text: t('compareNow') }))),
      h('tbody', {},
        row(t('compareSites'), before.recognisingSites, now.recognisingSites),
        row(t('compareMarketing'), total(before, 'marketing'), total(now, 'marketing')),
        row(t('compareAnalytics'), total(before, 'analytics'), total(now, 'analytics')),
        row(t('compareIdentifiers'), before.identifiers, now.identifiers),
      ),
    ),
    h('p', { class: 'note', text: t('compareNote') }),
  );
}

// "Adobe Audience Manager (demdex.net), Adobe Analytics (sky.it), newsroom.bi and 2 more"
function formatNames(names: string[]): string {
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown}, ${t('namesMore', names.length - 3)}` : shown;
}

const MARK: Record<Item['mark'], { icon: string; label: string }> = {
  ok: { icon: '\u2713', label: 'markOk' },
  bad: { icon: '\u2717', label: 'markBad' },
  info: { icon: '\u2139', label: 'markInfo' },
};

function checkItem(item: Item): HTMLElement {
  const text = item.count !== undefined ? tn(item.key, item.count, ...(item.subs ?? [])) : t(item.key, ...(item.subs ?? []));
  const names = item.names ?? item.nameKeys?.map((k) => t(k)) ?? [];
  const mark = h('span', { class: 'mark', text: MARK[item.mark].icon });
  // The symbol alone means nothing to a screen reader: say it in words.
  mark.setAttribute('aria-label', t(MARK[item.mark].label));
  mark.setAttribute('role', 'img');
  return h('li', { class: `item ${item.mark}` },
    mark,
    h('span', { text: names.length ? `${text} ${formatNames(names)}` : text }),
  );
}

// What the user asked, what happened, a cautious conclusion and the disclaimer.
function summaryBlock(host: string, own: Classified[], trackers: Classified[] | null,
  choice: ChoiceRecord | undefined, snapshot: Snapshot | undefined): HTMLElement {
  const verdict = buildVerdict(choice, own, trackers, Date.now());
  if (MEASURING) report({ host, choice: choice ?? null, items: verdict.items, conclusion: verdict.conclusion ?? null, ...diagnostics });
  const heading = choice ? t(`verdictHeading_${choice.choice}`, clock(choice.at)) : t('verdictHeadingNone');
  const parts: HTMLElement[] = [
    h('h1', { text: host }),
    h('p', { class: 'verdict-heading', text: heading }),
    h('ul', { class: 'checklist' }, ...verdict.items.map(checkItem)),
  ];
  if (verdict.conclusion) {
    parts.push(h('p', { class: `conclusion ${verdict.conclusion.tone}`, text: t(verdict.conclusion.key) }));
  }
  parts.push(h('p', { class: 'disclaimer', text: t('disclaimer') }));
  if (choice && snapshot && trackers !== null) {
    parts.push(h('details', { class: 'compare-wrap' },
      h('summary', { text: t('compareDetails') }),
      comparison(snapshot.summary, summarise(own, trackers), snapshot.at)));
  }
  return h('section', { class: 'summary' }, ...parts);
}

// Where the classifications come from and how old they are: the user can judge how
// current they are, and the licence asks for the credit.
const DATABASE_URL = 'https://github.com/jkwakman/Open-Cookie-Database';

async function databaseLine(): Promise<HTMLElement[]> {
  const raw = (await loadDb()).meta?.data_date;
  const when = raw ? new Date(`${raw}T12:00:00`) : undefined;
  if (!when || Number.isNaN(when.getTime())) return [];
  const month = when.toLocaleDateString(browser.i18n.getUILanguage(), { month: 'long', year: 'numeric' });
  // The sentence comes from the translations with a marker where the name goes; the
  // name becomes a link to the database, so the user can check the source.
  const MARK = '\u0001';
  const [before = '', after = ''] = t('databaseSource', MARK, month).split(MARK);
  const link = h('a', { text: 'Open Cookie Database' }) as HTMLAnchorElement;
  link.href = DATABASE_URL;
  link.target = '_blank'; // the popup cannot navigate itself: open a new tab
  link.rel = 'noopener noreferrer';
  return [h('p', { class: 'muted source-line' }, document.createTextNode(before), link, document.createTextNode(after))];
}

// ------------------------------------------------------------------ measurement
// Only in builds made for the quality measurement (`wxt build --mode test`, see
// quality/PROTOCOL.md). In every other build MEASURING is the constant false and the
// bundler removes this code: the published extension has none of it.
//   - ?tab=<id> chooses the tab to analyse: a robot that opens the popup in a tab of
//     its own would otherwise analyse that tab;
//   - the verdict is also written, as data, on <body data-verdict>, for the robot.
const MEASURING = import.meta.env.MODE === 'test';
// What the background recorded for the tab, to compare with the robot's raw data.
let diagnostics: Record<string, unknown> = {};

function report(data: unknown): void {
  document.body.dataset.verdict = JSON.stringify(data);
}

async function targetTab() {
  if (MEASURING) {
    const id = Number(new URLSearchParams(location.search).get('tab'));
    if (id) return browser.tabs.get(id);
  }
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ------------------------------------------------------------------ page

async function main(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app')!;
  document.documentElement.lang = browser.i18n.getUILanguage();
  app.replaceChildren(h('p', { class: 'muted', text: t('loading') }));
  try {
    const tab = await targetTab();
    const url = tab?.url;
    if (!url || tab.id === undefined || !/^https?:/.test(url)) {
      app.replaceChildren(h('p', { class: 'muted', text: t('openSite') }));
      return;
    }
    const host = new URL(url).hostname;
    const site = siteOf(host);
    const choice = await fromSession<ChoiceRecord>(choiceKey(site));
    const snapshot = await fromSession<Snapshot>(snapshotKey(site));
    const saved = readTabHosts(await fromSession(tabKey(tab.id)));
    // The background's list belongs to this page only if it was recorded for this host.
    const recorded = saved && new URL(saved.pageUrl).hostname === host ? saved : undefined;
    // After a choice, "now" means the trackers contacted after it.
    const hosts = recorded ? (choice ? hostsSince(recorded.lastSeen, choice.at) : Object.keys(recorded.lastSeen)) : [];
    if (MEASURING) diagnostics = { tabRecorded: saved ?? null, hostsConsidered: hosts };
    // Without descriptions the popup still works: they are an extra.
    const [{ own, trackers }] = await Promise.all([
      observe(url, hosts, Date.now()),
      loadDescriptions().then((d) => { descDb = d; }, () => {}),
    ]);

    app.replaceChildren(
      summaryBlock(host, own, recorded ? trackers : null, choice, snapshot),
      h('h2', { text: t('headingTrackers') }),
      ...(!recorded
        ? [h('p', { class: 'sub', text: t('noRequestData') })]
        : trackers.length === 0
          ? [h('p', { class: 'sub', text: t('none') })]
          : groups(trackers, 'trackers')),
      h('h2', { text: t('headingSite') }),
      ...(own.length === 0 ? [h('p', { class: 'sub', text: t('none') })] : groups(own, 'own')),
      h('p', { class: 'muted', text: t('footerNote') }),
      ...(await databaseLine()),
    );
  } catch (err) {
    app.replaceChildren(h('p', { class: 'alert', text: t('error', String(err)) }));
    if (MEASURING) report({ error: String(err) });
  } finally {
    if (MEASURING) document.body.dataset.ready = '1';
  }
}

void main();
