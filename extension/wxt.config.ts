import { defineConfig } from 'wxt';

// The manifest is generated from this file and from the files in entrypoints/.
// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: ({ browser }) => ({
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
    // Firefox only (Chrome does not know these keys).
    ...(browser === 'firefox' ? {
      browser_specific_settings: {
        gecko: {
          // Permanent once published. A random identifier (GUID form, accepted by
          // Firefox): it names neither a person nor the product, so it survives a rename.
          id: '{52ae60f1-8fbe-486e-a40e-911cb061c211}',
          // Shown to the user at install time. The extension transmits nothing, so it
          // collects no data in Firefox's sense: see PRIVACY.md.
          data_collection_permissions: { required: ['none'] },
        },
      },
    } : {}),
  }),
});
