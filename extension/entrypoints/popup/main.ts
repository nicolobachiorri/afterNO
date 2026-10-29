// Popup: the choice made in the banner, a summary and the comparison with the moment
// of the choice, then the cookies the trackers can read, then the site's own.
// This is the thin, browser-facing layer: read data, call the functions in lib/,
// display the result. The rules live in lib/ and are unit-tested.
import './style.css';
import { browser } from 'wxt/browser';
import { type ChoiceRecord } from '@/lib/choice';
import { observe } from '@/lib/cookies';
import { siteOf } from '@/lib/hosts';
import { MIN_IDENTIFIER_DAYS } from '@/lib/identifiers';
import { pluralKey } from '@/lib/plural';
import { hostsSince, type Classified, type Snapshot } from '@/lib/snapshot';
import { RECOGNISING, summarise, type Group, type Summary } from '@/lib/summary';
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

// One collapsible group. Groups that can recognise the user start open.
function groupBlock(group: Group, rows: Classified[]): HTMLElement {
  const items = rows
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name))
    .map((r) => h('li', {},
      h('span', { class: 'name', text: r.name }),
      h('span', { class: 'meta', text: [r.platform, r.domain, formatExpiry(r)].filter(Boolean).join(' · ') }),
    ));
  const details = h('details', { class: `group ${RECOGNISING.has(group) ? 'tracking' : ''}` },
    h('summary', { text: `${t(`group_${group}`)} (${rows.length})` }),
    ...(group === 'Identifier' ? [h('p', { class: 'note', text: t('groupNote_Identifier', MIN_IDENTIFIER_DAYS) })] : []),
    h('ul', {}, ...items),
  ) as HTMLDetailsElement;
  details.open = RECOGNISING.has(group);
  return details;
}

function groups(rows: Classified[]): HTMLElement[] {
  return ORDER
    .map((g) => [g, rows.filter((r) => r.group === g)] as const)
    .filter(([, rs]) => rs.length > 0)
    .map(([g, rs]) => groupBlock(g, [...rs]));
}

// ------------------------------------------------------------------ summary

function choiceLines(choice: ChoiceRecord | undefined): HTMLElement[] {
  if (!choice) return [h('p', { class: 'choice', text: t('choiceNone') })];
  const lines = [h('p', { class: 'choice strong', text: t(`choice_${choice.choice}`, clock(choice.at)) })];
  if (choice.source === 'tcf') {
    lines.push(h('p', { class: 'choice', text: t('choiceSourceTcf') }));
    if (choice.purposesTotal) {
      lines.push(h('p', { class: 'choice', text: t('choiceTcfDetail',
        choice.purposesConsented ?? 0, choice.purposesTotal, choice.legitimateInterests ?? 0) }));
    }
  } else {
    lines.push(h('p', { class: 'choice', text: t('choiceSourceClick', choice.label ?? '') }));
  }
  return lines;
}

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

function summaryBlock(host: string, own: Classified[], trackers: Classified[] | null,
  choice: ChoiceRecord | undefined, snapshot: Snapshot | undefined): HTMLElement {
  const s = summarise(own, trackers ?? []);
  // "After your rejection" only when a rejection was actually recorded.
  const rejected = choice?.choice === 'rejected';
  const headline = trackers === null
    ? t('reloadToSee')
    : s.recognisingSites === 0
      ? t(rejected ? 'afterRejectNone' : 'noRecognising')
      : tn(rejected ? 'afterRejectRecognising' : 'recognising', s.recognisingSites);
  const showCompare = choice && snapshot && trackers !== null;
  // Text and colour must say the same thing: red when third parties can recognise
  // the user, amber when only the site itself has marketing cookies, green otherwise.
  const siteOnly = s.recognisingSites === 0 && s.marketing.site > 0;
  const tone = s.recognisingSites > 0 ? 'alert' : siteOnly ? 'warn' : 'ok';
  return h('section', { class: 'summary' },
    h('h1', { text: host }),
    ...choiceLines(choice),
    h('p', { class: tone, text: headline }),
    ...(siteOnly && trackers !== null ? [h('p', { class: tone, text: tn('siteMarketingNote', s.marketing.site) })] : []),
    ...(showCompare
      ? [comparison(snapshot.summary, s, snapshot.at)]
      : [h('ul', { class: 'stats' },
        h('li', { text: t('statMarketing', s.marketing.site + s.marketing.trackers, s.marketing.site, s.marketing.trackers) }),
        h('li', { text: t('statAnalytics', s.analytics.site + s.analytics.trackers, s.analytics.site, s.analytics.trackers) }),
        h('li', { text: t('statIdentifiers', s.identifiers) }),
      )]),
  );
}

// ------------------------------------------------------------------ page

async function main(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app')!;
  document.documentElement.lang = browser.i18n.getUILanguage();
  app.replaceChildren(h('p', { class: 'muted', text: t('loading') }));
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
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
    const { own, trackers } = await observe(url, hosts, Date.now());

    app.replaceChildren(
      summaryBlock(host, own, recorded ? trackers : null, choice, snapshot),
      h('h2', { text: t('headingTrackers') }),
      ...(!recorded
        ? [h('p', { class: 'sub', text: t('noRequestData') })]
        : trackers.length === 0
          ? [h('p', { class: 'sub', text: t('none') })]
          : groups(trackers)),
      h('h2', { text: t('headingSite') }),
      ...(own.length === 0 ? [h('p', { class: 'sub', text: t('none') })] : groups(own)),
      h('p', { class: 'muted', text: t('footerNote') }),
    );
  } catch (err) {
    app.replaceChildren(h('p', { class: 'alert', text: t('error', String(err)) }));
  }
}

void main();
