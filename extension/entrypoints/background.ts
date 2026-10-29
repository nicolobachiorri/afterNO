// Background: records which hosts each tab contacts (and when), stores the choice
// made in the banner, and takes a snapshot at the moment of that choice. It only
// observes requests, never blocks or changes them, and stores nothing outside the
// browser.
//
// In Manifest V3 the background is a service worker: Chrome stops it after some
// seconds of inactivity and its variables are lost. So the data also goes to
// storage.session, which survives the restarts and is wiped when the browser closes.
import { browser } from 'wxt/browser';
import { isChoiceMessage, mergeChoice, type ChoiceRecord } from '@/lib/choice';
import { observe } from '@/lib/cookies';
import { siteOf } from '@/lib/hosts';
import { buildSnapshot, shouldTakeSnapshot, type Snapshot } from '@/lib/snapshot';
import { choiceKey, readTabHosts, snapshotKey, tabKey, type TabHosts } from '@/lib/tabstore';

export default defineBackground(() => {
  const memory = new Map<number, TabHosts>();
  const pending = new Map<number, ReturnType<typeof setTimeout>>();

  // After a restart, reload what was saved before the worker stopped.
  const ready = browser.storage.session.get(null).then((all) => {
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('tab:')) continue;
      const saved = readTabHosts(value);
      if (saved) memory.set(Number(key.slice(4)), saved);
    }
  });

  // Save at most every 300 ms per tab: a page can make hundreds of requests.
  function persist(tabId: number): void {
    if (pending.has(tabId)) return;
    pending.set(tabId, setTimeout(() => {
      pending.delete(tabId);
      const entry = memory.get(tabId);
      if (entry) void browser.storage.session.set({ [tabKey(tabId)]: entry });
    }, 300));
  }

  // Listeners must be registered synchronously, at the top level of this function,
  // otherwise the events that wake the worker up are missed.
  // The return type undefined says "observe only": a value here could block the request.
  browser.webRequest.onBeforeRequest.addListener(
    (details): undefined => {
      if (details.tabId < 0) return; // requests not tied to a tab
      let host: string;
      try {
        host = new URL(details.url).hostname;
      } catch {
        return;
      }
      const now = Date.now();
      void ready.then(() => {
        // A new top-level page starts a new list.
        if (details.type === 'main_frame') {
          memory.set(details.tabId, { pageUrl: details.url, lastSeen: { [host]: now } });
        } else {
          const entry = memory.get(details.tabId);
          if (!entry) return; // page loaded before the extension: reload it to see the trackers
          entry.lastSeen[host] = now;
        }
        persist(details.tabId);
      });
    },
    { urls: ['<all_urls>'] },
  );

  // Snapshot of what can recognise the user at this moment, with every host the tab
  // contacted so far: at the moment of a choice, all of it appeared before consent
  // or refusal. A second report of the same choice (click, then TCF) keeps the first.
  async function takeSnapshot(tabId: number, pageUrl: string, site: string, at: number): Promise<void> {
    const key = snapshotKey(site);
    const existing = (await browser.storage.session.get(key))[key] as Snapshot | undefined;
    if (!shouldTakeSnapshot(existing, at)) return;
    await ready;
    const hosts = Object.keys(memory.get(tabId)?.lastSeen ?? {});
    const { own, trackers } = await observe(pageUrl, hosts, at);
    await browser.storage.session.set({ [key]: buildSnapshot(site, at, own, trackers) });
  }

  // Choices noticed by the content script. The site comes from the tab's address,
  // not from the frame that sent the message: a banner may be an iframe of another
  // domain. Work is queued one message after the other, so that two messages
  // arriving together (TCF and a click) cannot overwrite each other.
  let queue: Promise<void> = Promise.resolve();
  browser.runtime.onMessage.addListener((message: unknown, sender): undefined => {
    const tab = sender.tab;
    if (!isChoiceMessage(message) || !tab?.url || tab.id === undefined) return;
    let site: string;
    try {
      site = siteOf(new URL(tab.url).hostname);
    } catch {
      return;
    }
    const tabId = tab.id;
    const pageUrl = tab.url;
    const incoming: ChoiceRecord = { ...message.record, site };
    const key = choiceKey(site);
    queue = queue.then(async () => {
      // The snapshot first: the sooner, the closer to the state before the choice.
      if (incoming.trigger === 'action') await takeSnapshot(tabId, pageUrl, site, incoming.at);
      const saved = (await browser.storage.session.get(key))[key] as ChoiceRecord | undefined;
      await browser.storage.session.set({ [key]: mergeChoice(saved, incoming) });
    }).catch(() => {});
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    memory.delete(tabId);
    void browser.storage.session.remove(tabKey(tabId));
  });
});
