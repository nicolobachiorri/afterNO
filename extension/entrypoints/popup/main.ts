// Popup: a summary first, then the cookies the trackers can read, then the site's own.
// This is the thin, browser-facing layer: read data, call the pure functions in
// lib/, display the result. All the rules live in lib/ and are unit-tested.
import './style.css';
import { browser, type Browser } from 'wxt/browser';
import { classify, type CookieDb } from '@/lib/classify';
import { isThirdParty } from '@/lib/hosts';
import { isLikelyIdentifier, MIN_IDENTIFIER_DAYS } from '@/lib/identifiers';
import { pluralKey } from '@/lib/plural';
import { RECOGNISING, summarise, type Group } from '@/lib/summary';
import { thirdPartyCookies } from '@/lib/thirdparty';
import { tabKey, type TabHosts } from '@/lib/tabstore';

type Cookie = Browser.cookies.Cookie;

// Every text comes from public/_locales/<language>/messages.json, chosen by the browser
// from the user's language. The cast keeps this file independent of the message-key
// types WXT generates, which are only refreshed when the dev server runs.
const getMessage = browser.i18n.getMessage as (key: string, substitutions?: string[]) => string;
const t = (key: string, ...subs: (string | number)[]): string => getMessage(key, subs.map(String)) || key;
const tn = (base: string, n: number, ...subs: (string | number)[]): string =>
  t(pluralKey(base, n, browser.i18n.getUILanguage()), n, ...subs);

// Order of the groups: what can recognise the user first.
const ORDER: Group[] = [
  'Marketing', 'Analytics', 'Identifier', 'Unknown', 'Personalization',
  'Preferences', 'Functional', 'Necessary', 'Security',
];

interface Row {
  name: string;
  domain: string;
  group: Group;
  platform: string;
  expires: string;
}

// Small helper to build DOM nodes. Cookie names come from websites, so they are
// untrusted: they are always inserted as text (textContent), never as HTML.
function h(tag: string, props: { class?: string; text?: string } = {}, ...children: Node[]): HTMLElement {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  el.append(...children);
  return el;
}

function formatExpiry(c: Cookie): string {
  if (c.session || c.expirationDate === undefined) return t('expirySession');
  const days = Math.round((c.expirationDate * 1000 - Date.now()) / 86_400_000);
  if (days < 1) return t('expiryUnderDay');
  if (days < 60) return tn('expiryDays', days);
  return tn('expiryMonths', Math.round(days / 30));
}

function toRow(c: Cookie, db: CookieDb, thirdParty: boolean): Row {
  const { category, platform } = classify(c.name, db);
  // The identifier hint only applies to tracker cookies: on the site's own domain,
  // "unknown" really means "we do not know".
  const group: Group = thirdParty && isLikelyIdentifier(c, category, Date.now()) ? 'Identifier' : category;
  return { name: c.name, domain: c.domain, group, platform, expires: formatExpiry(c) };
}

async function loadDb(): Promise<CookieDb> {
  // The database ships inside the extension (public/cookie-db.json): no network request.
  const res = await fetch(browser.runtime.getURL('/cookie-db.json'));
  return (await res.json()) as CookieDb;
}

// Cookies the trackers contacted by this page can read, using the hosts the
// background recorded. Returns null when there is no record for this page.
async function trackerCookies(tabId: number, pageUrl: string, firstParty: Cookie[]): Promise<Cookie[] | null> {
  const saved = (await browser.storage.session.get(tabKey(tabId)))[tabKey(tabId)] as TabHosts | undefined;
  const pageHost = new URL(pageUrl).hostname;
  if (!saved || new URL(saved.pageUrl).hostname !== pageHost) return null;

  const hosts = saved.hosts.filter((host) => isThirdParty(host, pageHost));
  const byHost: Record<string, Cookie[]> = {};
  await Promise.all(hosts.map(async (host) => {
    byHost[host] = await browser.cookies.getAll({ url: `https://${host}/` });
  }));
  return thirdPartyCookies(firstParty, byHost).map((f) => f.cookie);
}

// One collapsible group. Groups that can recognise the user start open.
function groupBlock(group: Group, rows: Row[]): HTMLElement {
  const items = rows
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name))
    .map((r) => h('li', {},
      h('span', { class: 'name', text: r.name }),
      h('span', { class: 'meta', text: [r.platform, r.domain, r.expires].filter(Boolean).join(' · ') }),
    ));
  const details = h('details', { class: `group ${RECOGNISING.has(group) ? 'tracking' : ''}` },
    h('summary', { text: `${t(`group_${group}`)} (${rows.length})` }),
    ...(group === 'Identifier' ? [h('p', { class: 'note', text: t('groupNote_Identifier', MIN_IDENTIFIER_DAYS) })] : []),
    h('ul', {}, ...items),
  ) as HTMLDetailsElement;
  details.open = RECOGNISING.has(group);
  return details;
}

function groups(rows: Row[]): HTMLElement[] {
  return ORDER
    .map((g) => [g, rows.filter((r) => r.group === g)] as const)
    .filter(([, rs]) => rs.length > 0)
    .map(([g, rs]) => groupBlock(g, [...rs]));
}

function summaryBlock(host: string, own: Row[], trackers: Row[] | null): HTMLElement {
  const s = summarise(own, trackers ?? []);
  const headline = trackers === null
    ? t('reloadToSee')
    : s.recognisingSites === 0
      ? t('noRecognising')
      : tn('recognising', s.recognisingSites);
  const lines = [
    t('statMarketing', s.marketing.site + s.marketing.trackers, s.marketing.site, s.marketing.trackers),
    t('statAnalytics', s.analytics.site + s.analytics.trackers, s.analytics.site, s.analytics.trackers),
    t('statIdentifiers', s.identifiers),
  ];
  return h('section', { class: 'summary' },
    h('h1', { text: host }),
    h('p', { class: s.recognisingSites > 0 || s.marketing.site > 0 ? 'alert' : 'ok', text: headline }),
    h('ul', { class: 'stats' }, ...lines.map((t) => h('li', { text: t }))),
  );
}

function render(app: HTMLElement, host: string, own: Row[], trackers: Row[] | null): void {
  app.replaceChildren(
    summaryBlock(host, own, trackers),
    h('h2', { text: t('headingTrackers') }),
    ...(trackers === null
      ? [h('p', { class: 'sub', text: t('noRequestData') })]
      : trackers.length === 0
        ? [h('p', { class: 'sub', text: t('none') })]
        : groups(trackers)),
    h('h2', { text: t('headingSite') }),
    ...(own.length === 0 ? [h('p', { class: 'sub', text: t('none') })] : groups(own)),
    h('p', { class: 'muted', text: t('footerNote') }),
  );
}

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
    const db = await loadDb();
    const firstParty = await browser.cookies.getAll({ url });
    const tracker = await trackerCookies(tab.id, url, firstParty);
    render(
      app,
      new URL(url).hostname,
      firstParty.map((c) => toRow(c, db, false)),
      tracker ? tracker.map((c) => toRow(c, db, true)) : null,
    );
  } catch (err) {
    app.replaceChildren(h('p', { class: 'alert', text: t('error', String(err)) }));
  }
}

void main();
