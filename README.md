# Cookie summary (working title)

A browser extension that tells you, in plain words, what a cookie banner's choice
changed, and whether the site seems to respect it.

You click "Reject" on a cookie banner. Did anything change? The extension compares
what you asked for with what your browser can actually observe afterwards, and shows
it as a short checklist with a cautious conclusion.

> **In italiano.** Un'estensione per il browser che spiega in parole semplici cosa ha
> cambiato la tua scelta nel banner dei cookie e se il sito sembra rispettarla. Hai
> cliccato «Rifiuta»: l'estensione confronta quello che hai chiesto con quello che il
> browser osserva dopo, e lo mostra come una breve lista di controllo con una
> conclusione prudente. L'interfaccia è in italiano e in inglese.

**Status:** in development, not yet published in any store.

## What it shows

Open the extension's popup on any site (it shows nothing until you ask):

- **Your choice**: read from the site's consent signal (the IAB TCF standard, used by
  most news and ad-funded sites) or, when there is none, from the button you clicked.
- **A checklist**: each item marked in favour, against, or as information. For example:
  "3 third-party sites can still recognise you from this page: …".
- **A cautious conclusion**: "Your rejection seems to be respected" / "…seems to be
  only partly respected". Never "the site is breaking the law".
- **The cookies**, grouped by kind, with the company behind them, how long they last,
  and the database's description.

## How sure is it? Three levels

Every sentence in the popup states where its information comes from:

| Level | Example | Source |
| --- | --- | --- |
| **Observed** | "The site's consent signal records your rejection" | what the browser sees: cookies, contacted sites, the TCF signal |
| **Possible** | "3 third-party sites *can* recognise you" | a technical capability (a long-lived cookie sent back to a tracker), not proof that it is used |
| **Classified** | "1 cookie is *classified as* marketing" | the Open Cookie Database, compiled mostly from what companies declare |

The main question (can third parties still recognise you after a rejection?) rests on
the first two levels. The database only adds labels and descriptions.

## What it cannot see

An extension sees what the browser sees. It does not see, and does not claim to see:

- recognition **without cookies** (browser fingerprinting);
- data passed **between companies' servers**;
- cookies stored in **partitioned** storage (not read yet);
- **what a company does** with a cookie: purposes are declared, not observable;
- cookies whose names are **not in the database**: shown as "unclassified", or as
  "likely identifiers" when they behave like one.

Accuracy on real sites has not been measured yet. A measurement on 30-50 sites is
planned before the first release, and its result will be reported here.

## Privacy

Everything happens in your browser. The extension sends nothing anywhere: no server,
no analytics, no network requests of its own (the cookie database ships inside it).
What it reads, what it keeps (only until the browser closes) and why is listed in
[PRIVACY.md](PRIVACY.md).

## Build it yourself

Requirements: Node.js 22 or later; Python 3 only to rebuild the cookie database.

```sh
cd extension
npm install
npm run dev        # opens Chrome with the extension loaded
npm run dev:firefox
npm test           # unit tests (Node's built-in test runner)
npm run compile    # type check
npm run build      # production build in extension/.output/
```

To rebuild the cookie database from a newer Open Cookie Database CSV, put the file in
`divergence_work_space/open-cookie-database.csv` and run `npm run db`.

## Project layout

```
extension/            the browser extension (WXT, TypeScript, Manifest V3)
  entrypoints/        background, content script (banner choice), popup
  lib/                the rules: classification, verdict, texts; pure and unit-tested
  public/             translations (_locales/), icons, cookie database (JSON)
tools/                build_cookie_db.py: CSV -> JSON
divergence_work_space/  step 1: the measurement that motivated the project
design/               icon source
```

## How it was made

The idea, the product decisions (what to build and what to leave out, the cautious
wording, the legal caution) and the testing on real sites are by Nicolò Bachiorri.
Most of the code was written with Claude, an AI assistant by Anthropic, in a
step-by-step collaboration: each change was explained, reviewed and tested on real
sites before being kept. This is stated so that anyone reusing the code knows how it
came about.

## Related work

Others have worked on parts of this problem. This project builds on the same ideas and
differs mainly in who it is for and in putting the pieces together.

- **[Cookie Glasses](https://chrome.google.com/webstore/detail/cookie-glasses/gncnjghkclkhpkfhghcbobednpchjifk)**
  (Matte, Santos, Bielova, Inria) shows the consent a banner registered in the IAB TCF,
  to reveal a "yes" stored where the user said "no". It comes from the study
  [*Do Cookie Banners Respect my Choice?*](https://arxiv.org/abs/1911.09964). It reads
  the TCF signal only.
- **[ConsentScope](https://chromewebstore.google.com/detail/bckfbligemognhkpoojinnlemmiaifmj)**
  is an auditing tool for developers and privacy professionals: it records cookies,
  storage and requests on a timeline before and after the consent choice.
- **[CookieBlock](https://usenix.org/conference/usenixsecurity22/presentation/bollinger)**
  (ETH Zurich, USENIX Security 2022) classifies cookies with a machine-learning model
  and deletes those the user did not consent to.
- **Ghostery Never-Consent, Consent-O-Matic, uBlock Origin** reject banners or block
  trackers on the user's behalf. They act; this extension explains, and can be used
  alongside them.

What this extension adds: a check made **after** your choice, in your own session,
that combines what the site declares (TCF) with what the browser observes (cookies and
contacted sites), also works on sites without TCF, states how certain each statement
is, and speaks to people who are not technical, in Italian and English, with nothing
leaving the browser.

## Credits

Cookie categories, platforms and descriptions come from the
[Open Cookie Database](https://github.com/jkwakman/Open-Cookie-Database) (jkwakman
and contributors), licensed under Apache-2.0. A few entries are corrected
locally (`divergence_work_space/overrides.csv`), each with its reason.

## Licence

Apache License 2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE). You may use, modify
and redistribute this code, also commercially, as long as you keep the notices.

## Disclaimer

The extension gives an automatic indication based on what the browser observes. It may
be incomplete or wrong and is not a legal assessment.
