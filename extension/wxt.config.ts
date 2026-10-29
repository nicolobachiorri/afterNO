import { defineConfig } from 'wxt';

// The manifest is generated from this file and from the files in entrypoints/.
// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: {
    // Texts come from public/_locales/<language>/messages.json; __MSG_key__ is replaced
    // by the browser. English is used for any language without its own folder.
    default_locale: 'en',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    permissions: [
      // Read the cookie store, including HttpOnly cookies the page cannot see.
      'cookies',
      // Observe (not block) the requests a page makes, to know which trackers it contacts.
      'webRequest',
      // storage.session: keeps the list of contacted hosts when the background restarts.
      'storage',
    ],
    // Without host permissions cookies.getAll and webRequest see nothing, silently.
    // "<all_urls>" is broad, but the extension has to work on every site the user visits.
    host_permissions: ['<all_urls>'],
  },
});
