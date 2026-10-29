// Shape and key of what the background saves in storage.session for each tab.
// It lives in lib/ because both the background and the popup use it: importing it
// from an entrypoint would pull the whole background code into the popup.

export interface TabHosts {
  pageUrl: string; // the top-level page the hosts belong to
  hosts: string[]; // every host the tab contacted while showing that page, sorted
}

export const tabKey = (tabId: number): string => `tab:${tabId}`;

// The choice made in the banner is stored per site, not per tab: the same site in
// another tab, or after a reload, still shows it. Wiped when the browser closes.
export const choiceKey = (site: string): string => `choice:${site}`;
