// The answer to the user's question: "is my choice being respected?".
// It compares what the user asked (the choice in the banner) with what the browser
// can observe, as a checklist of facts, each marked:
//   ok   a fact in favour      (shown with a check mark)
//   bad  a fact against        (shown with a cross)
//   info a neutral fact or a limit of what can be known
// and a cautious conclusion ("seems"), built only from the items shown above it.
// Pure: the popup turns keys into text and draws the marks.
import type { ChoiceRecord } from './choice.ts';
import { siteOf } from './hosts.ts';
import { RECOGNISING, type Group } from './summary.ts';

export type Mark = 'ok' | 'bad' | 'info';

export interface Item {
  mark: Mark;
  key: string; // message key; with `count`, the base of a plural pair (_one/_other)
  count?: number;
  subs?: (string | number)[];
  names?: string[]; // companies or sites involved, shown after the text
}

export interface Verdict {
  items: Item[];
  conclusion?: { key: string; tone: 'ok' | 'warn' | 'alert' | 'muted' };
}

export interface Row {
  domain: string;
  group: Group;
  platform: string;
  owners?: string[];
  session?: boolean;
  expirationDate?: number; // seconds since the epoch
}

// A marketing cookie of the site does not weigh the same in every case.
//   own    the database says it belongs to the site itself (Pinterest's cookie on
//          pinterest.com). The database describes it as marketing because of what it
//          does on OTHER sites, through the platform's buttons and pixels; at home we
//          cannot tell what it is for.
//   short  it expires within a day, or when the browser closes: it cannot recognise
//          the user from one day to the next.
//   strong everything else. Only these count against a rejection.
export const SHORT_LIVED_MS = 86_400_000;

export function marketingKind(r: Row, nowMs: number): 'own' | 'short' | 'strong' {
  const site = siteOf(r.domain.replace(/^\./, ''));
  if (r.owners?.some((o) => siteOf(o.replace(/^\./, '')) === site)) return 'own';
  if (r.session || r.expirationDate === undefined || r.expirationDate * 1000 - nowMs <= SHORT_LIVED_MS) return 'short';
  return 'strong';
}

// One readable name per third-party site: "Adobe Audience Manager (demdex.net)".
export function namesBySite(rows: Row[]): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const site = siteOf(r.domain.replace(/^\./, ''));
    if (!seen.has(site)) seen.set(site, r.platform ? `${r.platform} (${site})` : site);
  }
  return [...seen.values()];
}

// One readable name per cookie platform, for the site's own cookies: "Google Ads".
export function platformNames(rows: Row[]): string[] {
  return [...new Set(rows.map((r) => r.platform).filter(Boolean))];
}

export function buildVerdict(choice: ChoiceRecord | undefined, own: Row[], trackers: Row[] | null, nowMs: number): Verdict {
  const items: Item[] = [];
  const recognising = (trackers ?? []).filter((r) => RECOGNISING.has(r.group));
  const thirdNames = namesBySite(recognising);
  const siteMarketing = own.filter((r) => r.group === 'Marketing');
  const kinds = { own: [] as Row[], short: [] as Row[], strong: [] as Row[] };
  for (const r of siteMarketing) kinds[marketingKind(r, nowMs)].push(r);
  const siteAnalytics = own.filter((r) => r.group === 'Analytics');
  const rejected = choice?.choice === 'rejected';

  // 1. Was the choice recorded?
  if (choice?.source === 'tcf' && rejected) {
    items.push({ mark: 'ok', key: 'itemTcfRecorded', subs: [choice.purposesConsented ?? 0, choice.purposesTotal ?? 0] });
    if ((choice.legitimateInterests ?? 0) > 0) {
      items.push({ mark: 'bad', key: 'itemLegitimate', count: choice.legitimateInterests });
    }
  } else if (choice?.source === 'click') {
    items.push({ mark: 'info', key: 'itemClickOnly', subs: [choice.label ?? ''] });
  }

  // 2. Third parties that can recognise the user from this page.
  if (trackers !== null) {
    if (thirdNames.length === 0) {
      items.push({ mark: rejected || !choice ? 'ok' : 'info', key: 'itemNoThirdParty' });
    } else if (rejected) {
      items.push({ mark: 'bad', key: 'itemThirdPartyStill', count: thirdNames.length, names: thirdNames });
    } else if (!choice) {
      // No consent recorded: whatever is active now is active without it.
      items.push({ mark: 'bad', key: 'itemThirdPartyNoChoice', count: thirdNames.length, names: thirdNames });
    } else {
      items.push({ mark: 'info', key: 'itemThirdParty', count: thirdNames.length, names: thirdNames });
    }
  }

  // 3. The site's own marketing and analytics cookies.
  if (siteMarketing.length === 0) {
    if (rejected || !choice) items.push({ mark: 'ok', key: 'itemNoSiteMarketing' });
  }
  if (kinds.strong.length > 0) {
    items.push({
      mark: rejected || !choice ? 'bad' : 'info', key: 'itemSiteMarketing',
      count: kinds.strong.length, names: platformNames(kinds.strong),
    });
  }
  if (kinds.own.length > 0) {
    // No names: they would repeat the site itself ("Pinterest" on pinterest.com).
    items.push({ mark: 'info', key: 'itemSiteMarketingOwn', count: kinds.own.length });
  }
  if (kinds.short.length > 0) {
    items.push({ mark: 'info', key: 'itemSiteMarketingShort', count: kinds.short.length, names: platformNames(kinds.short) });
  }
  if (siteAnalytics.length > 0) {
    // Analytics cookies may be allowed without consent in some configurations:
    // stated as information, never as a fault.
    items.push({ mark: 'info', key: 'itemSiteAnalytics', count: siteAnalytics.length, names: platformNames(siteAnalytics) });
  }

  // Conclusion.
  let conclusion: Verdict['conclusion'];
  if (trackers === null) {
    conclusion = { key: 'verdictNeedReload', tone: 'muted' };
  } else if (rejected) {
    const bad = items.filter((i) => i.mark === 'bad');
    if (bad.length === 0) conclusion = { key: 'verdictRespected', tone: 'ok' };
    else if (thirdNames.length > 0) conclusion = { key: 'verdictPartly', tone: 'alert' };
    else conclusion = { key: 'verdictPartly', tone: 'warn' };
  } else if (choice?.choice === 'accepted') {
    conclusion = { key: 'verdictAccepted', tone: 'muted' };
  } else if (choice?.choice === 'partial') {
    conclusion = { key: 'verdictPartialChoice', tone: 'muted' };
  }
  return { items, conclusion };
}
