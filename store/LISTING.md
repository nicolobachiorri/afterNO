# Store listings

Texts to paste into the Chrome Web Store and Firefox Add-ons (AMO) forms. Keep them in
line with README.md and PRIVACY.md: if the extension changes, change them here first.

Contact email (both stores): afterno.extension@gmail.com
Privacy policy URL: https://github.com/nicolobachiorri/afterNO/blob/main/PRIVACY.md
Homepage URL: https://nicolobachiorri.github.io/afterNO/
Support URL: the GitHub repository

---

## Common fields

| Field | Value |
| --- | --- |
| Name | afterNO |
| Short description (EN, from the manifest, 131/132 characters) | What happens after you reject cookies: compares your choice with the cookies and trackers it observes. Nothing leaves your browser. |
| Short description (IT, 128/132) | Cosa succede dopo il tuo rifiuto dei cookie: confronta la tua scelta con cookie e tracker osservati. Nulla esce dal tuo browser. |
| Category (Chrome) | Privacy & Security |
| Category (Firefox) | Privacy & Security |
| Languages | English, Italian |
| Price | Free |
| Licence (Firefox asks) | Apache License 2.0 |

---

## Detailed description: English

Plain text: the stores do not render Markdown, and every line break shows. Paste the
block as it is.

```
You click "Reject" on a cookie banner. Did anything change?

afterNO compares what you asked for with what your browser can actually observe afterwards, and shows it in plain words when you open its popup.

WHAT IT SHOWS
• Your choice, read from the site's consent signal (the IAB TCF standard used by most news and ad-funded sites) or, when there is none, from the button you clicked or the X you closed the banner with.
• A short checklist: for example, "3 third-party sites can still recognise you from this page", with their names.
• A cautious conclusion: "your rejection seems to be respected" or "seems to be only partly respected". It never says that a site is breaking the law.
• The cookies, grouped by kind, with the company behind them and how long they last.

HOW SURE IS IT
Every sentence says where its information comes from: what the browser observed, what is technically possible (a cookie a tracker could use to recognise you), or what a public database declares (the Open Cookie Database). The information may be incomplete or wrong: treat it as a hint, not a verdict.

WHAT IT CANNOT SEE
Recognition without cookies (fingerprinting), other browser storage, data exchanged between companies' servers, and what a company actually does with a cookie.

DESIGNED FOR BROWSING IN THE EU
It reads the European consent standard (IAB TCF) and cookie banners in eight EU languages (Italian, English, French, German, Spanish, Portuguese, Dutch, Polish). The interface is in Italian and English. On sites that show no banner, for example outside the EU, it has less to say.

PRIVACY
Everything happens in your browser. No server, no analytics, no account, no network requests of its own. What it keeps is deleted when you close the browser. It does not block anything and does not click banners for you.

Open source (Apache 2.0). Accuracy measured on random samples of Italian and other EU sites, with method and data published on GitHub.
```

---

## Descrizione dettagliata: italiano

```
Clicchi «Rifiuta» nel banner dei cookie. È cambiato qualcosa?

afterNO confronta quello che hai chiesto con quello che il browser osserva dopo, e te lo spiega in parole semplici quando apri il suo riquadro.

COSA MOSTRA
• La tua scelta, letta dal segnale di consenso del sito (lo standard IAB TCF, usato dalla maggior parte dei siti di notizie e finanziati dalla pubblicità) oppure, se non c'è, dal pulsante che hai cliccato o dalla X con cui hai chiuso il banner.
• Una breve lista di controllo: per esempio «3 siti terzi possono ancora riconoscerti da questa pagina», con i loro nomi.
• Una conclusione prudente: «il tuo rifiuto sembra rispettato» oppure «sembra rispettato solo in parte». Non dice mai che un sito viola la legge.
• I cookie, divisi per tipo, con l'azienda che li usa e quanto durano.

QUANTO È SICURO
Ogni frase dice da dove viene l'informazione: ciò che il browser ha osservato, ciò che è tecnicamente possibile (un cookie con cui un tracker potrebbe riconoscerti) o ciò che dichiara un database pubblico (l'Open Cookie Database). L'informazione può essere incompleta o errata: prendila come un'indicazione, non come un giudizio.

COSA NON PUÒ VEDERE
Il riconoscimento senza cookie (fingerprinting), altre memorie del browser, i dati scambiati tra i server delle aziende e ciò che un'azienda fa davvero con un cookie.

PENSATA PER LA NAVIGAZIONE NELL'UE
Legge lo standard europeo del consenso (IAB TCF) e i banner in otto lingue dell'UE (italiano, inglese, francese, tedesco, spagnolo, portoghese, olandese, polacco). L'interfaccia è in italiano e in inglese. Sui siti che non mostrano un banner, per esempio fuori dall'UE, ha meno da dire.

PRIVACY
Tutto avviene nel tuo browser. Nessun server, nessuna statistica, nessun account, nessuna richiesta di rete propria. Quello che conserva viene cancellato alla chiusura del browser. Non blocca nulla e non clicca i banner al posto tuo.

Open source (Apache 2.0). Accuratezza misurata su campioni casuali di siti italiani e di altri paesi dell'UE, con metodo e dati pubblicati su GitHub.
```

---

## Release notes (Firefox asks for them at every upload)

**0.1.2**
EN: Closing a banner with its X is now recognised. "Accept selected" and "save" buttons
are no longer read as an acceptance. A click made by the site's own script is not taken
for yours. Site names with public suffixes (co.uk, gov.it) are handled with the Public
Suffix List. Cookies set through Cloudflare Zaraz are recognised.
IT: La chiusura del banner con la X ora è riconosciuta. I pulsanti «accetta selezionati»
e «salva» non valgono più come accettazione. Un clic fatto da uno script del sito non
viene scambiato per il tuo. I nomi dei siti con suffissi pubblici (co.uk, gov.it) sono
gestiti con la Public Suffix List. I cookie impostati tramite Cloudflare Zaraz sono
riconosciuti.

---

## Chrome Web Store: Privacy practices tab

**Single purpose**
Shows the user whether a website respects the choice they made in its cookie banner,
by comparing that choice with the cookies and third-party requests the browser
observes on that site.

**Permission justifications**

| Permission | Justification |
| --- | --- |
| cookies | Reads the names, domains and expiry of the cookies of the current site and of the third-party sites it contacts, to show which ones could recognise the user after a rejection. Cookie values are not stored or shown. |
| webRequest | Observes, without blocking or modifying, which third-party hosts the current page contacts, so the popup can list the trackers that are still contacted after a rejection. Only host names and times are kept, in session storage. |
| storage | Uses storage.session only, to keep the user's banner choice and the list of contacted hosts while the browser is open. Cleared when the browser closes. |
| Host permissions (<all_urls>) | The user can open the popup on any website, and the browser hides cookies and requests of sites the extension has no access to. Nothing is read until the user visits a page, and nothing leaves the browser. |
| Content script on all pages | Reads the site's IAB TCF consent signal and recognises clicks on "Reject", "Accept" or the closing X in cookie banners. Any other click is discarded immediately. |

**Remote code**: No, I am not using remote code.

**Data usage**: Google asks for disclosure even when data is only processed or stored
locally (Chrome Web Store user data FAQ: "Extensions are required to disclose how they
handle user data, even when data is processed or stored locally"). Tick:
- Web history (the site being viewed and the third-party hosts it contacts, kept in
  storage.session until the browser closes);
- User activity (network monitoring through webRequest; clicks on cookie-banner
  buttons, any other click discarded);
- Website content (the text of cookie-banner buttons and the site's TCF signal).
Nothing else (no personal identifiers, health, financial, authentication data,
communications or location). Then tick the three certifications (no sale or transfer,
no unrelated use, no creditworthiness use): all true, since nothing leaves the device.

**Privacy policy URL**: the GitHub address of PRIVACY.md.

---

## Firefox Add-ons (AMO): extra fields

- **Summary** (250 characters max): use the short description above.
- **Source code**: AMO asks for it because the build is bundled by WXT/Vite. Upload a
  zip of the repository without node_modules and .output (`npm run zip:firefox` in
  extension/ also creates a sources zip), with these build instructions:
  "Node.js 22+, then in extension/: npm ci && npm run build:firefox. Output in
  extension/.output/firefox-mv2."
- **Data collection**: the manifest already declares `data_collection_permissions:
  none`.
- **Notes for reviewers**: "No network requests of its own; the cookie database ships
  in public/cookie-db.json, built from the Open Cookie Database (Apache 2.0) by
  tools/build_cookie_db.py."

---

## Images to prepare

| Store | What | Size |
| --- | --- | --- |
| Chrome | Icon | 128×128 (already in extension/public/icon) |
| Chrome | Screenshots, 1 to 5 | 1280×800 or 640×400 |
| Chrome | Small promo tile | 440×280 |
| Firefox | Screenshots (optional but recommended) | any size, 1280×800 works |

Suggested screenshots: the popup on a site where the rejection seems respected, one
where it seems only partly respected, and the cookie list. Use the same sites in both
languages (one set with the browser in Italian, one in English).
