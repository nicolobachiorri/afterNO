# afterNO: privacy policy

*Last updated: 10 November 2026. Applies to version 0.1.0 and later.*
*[Versione italiana più sotto.](#afterno-informativa-sulla-privacy)*

**In short: the extension sends nothing anywhere.** Everything it reads stays in your
browser. What it keeps is deleted when you close the browser.

## What the extension reads, and why

| What | Why | Where it goes |
| --- | --- | --- |
| **Cookies** of the site you are on, and of the third-party sites that page contacts: name, domain, expiry, whether other sites can read them (SameSite) | To show which cookies exist and which ones can recognise you | Processed in the browser. The browser also returns cookie **values**: the extension does not store them or show them |
| **The addresses of the requests** a page makes | To know which third-party sites the page contacts, and when | Only the **host name** (for example `criteo.com`) and the time are kept, not the full address |
| **The address of the page** you are on | To match the list of contacted sites to the page it belongs to | Kept in session storage (see below) |
| **The consent signal** of the site (IAB TCF), when there is one: whether you consented, how many purposes, "legitimate interest" | To know what the site recorded about your choice | Only the counts and the choice are kept |
| **What you click on a page**: the text, label and attributes of the clicked element, and the text around it | To recognise a click on "Reject", "Accept" or the closing X in a cookie banner | Checked on the spot. Only a click recognised as a banner choice is kept, with the button's label; every other click is discarded at once |

## What it keeps, and for how long

The extension uses the browser's **session storage** (`storage.session`). It lives in
memory and is **deleted when the browser closes**. It holds:

- for each open tab: the page address, the host names contacted and when (removed when the tab is closed);
- for each site where you made a choice: the choice, its time, the button label or the TCF counts;
- for each such site: a snapshot taken at the moment of the choice, with counts and the
  names and domains of the cookies that could recognise you then.

Nothing is written to disk storage, and nothing is synchronised with your account.

One exception, for a moment: when you click a choice in a banner, the extension also
keeps that choice (accepted or rejected, the time, the button's label) in the **session
storage of the site you clicked on**, so that it is not lost if the banner reloads the
page. It is removed as soon as the next page has read it, and ignored after two
minutes. The site can technically read it, but it only contains the choice you just
made on that site. Its presence, under the key `__afterno_choice`, also tells that site,
for those few moments, that afterNO is installed.

## What it never does

- It makes **no network requests** of its own. The cookie database ships inside the
  extension. The only link that leaves it (to the database's page on GitHub) opens
  only if you click it.
- No analytics, no telemetry, no advertising, no accounts.
- It does not sell, transfer or share any data, and does not use it for any purpose
  other than showing you the popup.
- It does not block or change requests, and does not click banners for you.

## Permissions

| Permission | Why |
| --- | --- |
| `cookies` | Read the cookies described above, including those the page itself cannot see (HttpOnly) |
| `webRequest` | Observe, without blocking, which sites a page contacts |
| `storage` | Session storage, as described above |
| Access to all sites (`<all_urls>`) | The extension must work on any site you visit; without it the browser hides cookies and requests |
| Content script on all pages | Read the consent signal and recognise clicks on cookie banners |

## Chrome Web Store: limited use

The use of information received from Google APIs will adhere to the Chrome Web Store
User Data Policy, including the Limited Use requirements.

## Changes and contact

Changes to this policy are recorded in the project's history on GitHub, with the date
at the top of this page. Questions: open an issue on the project's GitHub page, or
write to afterno.extension@gmail.com.

---

# afterNO: informativa sulla privacy

*Ultimo aggiornamento: 10 novembre 2026. Vale per la versione 0.1.0 e successive.*

**In breve: l'estensione non invia nulla a nessuno.** Tutto ciò che legge resta nel tuo
browser. Quello che conserva viene cancellato quando chiudi il browser.

## Cosa legge l'estensione, e perché

| Cosa | Perché | Dove va |
| --- | --- | --- |
| **I cookie** del sito su cui sei e dei siti terzi che la pagina contatta: nome, dominio, scadenza, se altri siti possono leggerli (SameSite) | Per mostrare quali cookie esistono e quali possono riconoscerti | Elaborati nel browser. Il browser restituisce anche i **valori** dei cookie: l'estensione non li conserva e non li mostra |
| **Gli indirizzi delle richieste** fatte dalla pagina | Per sapere quali siti terzi la pagina contatta, e quando | Si conserva solo il **nome del sito** (per esempio `criteo.com`) e l'ora, non l'indirizzo completo |
| **L'indirizzo della pagina** su cui sei | Per associare l'elenco dei siti contattati alla pagina giusta | Conservato nella memoria di sessione (vedi sotto) |
| **Il segnale di consenso** del sito (IAB TCF), se presente: se hai dato il consenso, quante finalità, il «legittimo interesse» | Per sapere cosa ha registrato il sito sulla tua scelta | Si conservano solo i conteggi e la scelta |
| **Ciò che clicchi in una pagina**: testo, etichetta e attributi dell'elemento cliccato, e il testo intorno | Per riconoscere un clic su «Rifiuta», «Accetta» o sulla X di chiusura in un banner dei cookie | Controllato sul momento. Si conserva solo un clic riconosciuto come scelta nel banner, con l'etichetta del pulsante; ogni altro clic viene scartato subito |

## Cosa conserva, e per quanto

L'estensione usa la **memoria di sessione** del browser (`storage.session`), che sta in
memoria e viene **cancellata alla chiusura del browser**. Contiene:

- per ogni scheda aperta: l'indirizzo della pagina, i siti contattati e quando (rimossi quando chiudi la scheda);
- per ogni sito in cui hai fatto una scelta: la scelta, l'ora, l'etichetta del pulsante o i conteggi TCF;
- per ciascuno di questi siti: una fotografia presa al momento della scelta, con i
  conteggi e i nomi e domini dei cookie che allora potevano riconoscerti.

Nulla viene scritto su disco e nulla viene sincronizzato con il tuo account.

Un'eccezione, per un istante: quando clicchi una scelta in un banner, l'estensione
conserva quella scelta (accettato o rifiutato, l'ora, l'etichetta del pulsante) anche
nella **memoria di sessione del sito su cui hai cliccato**, per non perderla se il banner
ricarica la pagina. Viene cancellata appena la pagina successiva l'ha letta, e ignorata
dopo due minuti. Il sito può tecnicamente leggerla, ma contiene solo la scelta che hai
appena fatto su quel sito. La sua presenza, con la chiave `__afterno_choice`, dice anche
a quel sito, per quei pochi istanti, che afterNO è installata.

## Cosa non fa mai

- Non fa **nessuna richiesta di rete** propria. Il database dei cookie è contenuto
  nell'estensione. L'unico link verso l'esterno (la pagina del database su GitHub) si
  apre solo se lo clicchi.
- Niente statistiche d'uso, telemetria, pubblicità o account.
- Non vende, non trasferisce e non condivide dati, e non li usa per nessuno scopo
  diverso dal mostrarti il riepilogo.
- Non blocca né modifica le richieste, e non clicca i banner al posto tuo.

## Permessi

| Permesso | Perché |
| --- | --- |
| `cookies` | Leggere i cookie descritti sopra, compresi quelli che la pagina stessa non vede (HttpOnly) |
| `webRequest` | Osservare, senza bloccare, quali siti contatta una pagina |
| `storage` | La memoria di sessione descritta sopra |
| Accesso a tutti i siti (`<all_urls>`) | L'estensione deve funzionare su qualunque sito visiti; senza, il browser nasconde cookie e richieste |
| Script nelle pagine | Leggere il segnale di consenso e riconoscere i clic nei banner dei cookie |

## Chrome Web Store: uso limitato

L'uso delle informazioni ricevute dalle API di Google rispetta la Chrome Web Store User
Data Policy, compresi i requisiti di uso limitato (Limited Use).

## Modifiche e contatti

Le modifiche a questa informativa restano nella cronologia del progetto su GitHub, con
la data in cima alla pagina. Per domande: apri una segnalazione (issue) sulla pagina
GitHub del progetto, oppure scrivi ad afterno.extension@gmail.com.
