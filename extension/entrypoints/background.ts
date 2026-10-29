// Background: records which hosts each tab contacts, so the popup can look up the
// cookies of the trackers on the page. It only observes requests, never blocks or
// changes them, and stores nothing outside the browser.
//
// In Manifest V3 the background is a service worker: Chrome stops it after some
// seconds of inactivity and its variables are lost. So the data also goes to
// storage.session, which survives the restarts and is wiped when the browser closes.
import { browser } from 'wxt/browser';
import { tabKey, type TabHosts } from '@/lib/tabstore';

export default defineBackground(() => {
  const memory = new Map<number, { pageUrl: string; hosts: Set<string> }>();
  const pending = new Map<number, ReturnType<typeof setTimeout>>();

  // After a restart, reload what was saved before the worker stopped.
  const ready = browser.storage.session.get(null).then((all) => {
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('tab:')) continue;
      const v = value as TabHosts;
      memory.set(Number(key.slice(4)), { pageUrl: v.pageUrl, hosts: new Set(v.hosts) });
    }
  });

  // Save at most every 300 ms per tab: a page can make hundreds of requests.
  function persist(tabId: number): void {
    if (pending.has(tabId)) return;
    pending.set(tabId, setTimeout(() => {
      pending.delete(tabId);
      const entry = memory.get(tabId);
      if (!entry) return;
      const value: TabHosts = { pageUrl: entry.pageUrl, hosts: [...entry.hosts].sort() };
      void browser.storage.session.set({ [tabKey(tabId)]: value });
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
      void ready.then(() => {
        // A new top-level page starts a new list.
        if (details.type === 'main_frame') {
          memory.set(details.tabId, { pageUrl: details.url, hosts: new Set([host]) });
        } else {
          const entry = memory.get(details.tabId);
          if (!entry) return; // page loaded before the extension: reload it to see the trackers
          entry.hosts.add(host);
        }
        persist(details.tabId);
      });
    },
    { urls: ['<all_urls>'] },
  );

  browser.tabs.onRemoved.addListener((tabId) => {
    memory.delete(tabId);
    void browser.storage.session.remove(tabKey(tabId));
  });
});
