# afterNO

*What happens after you reject cookies. / Cosa succede dopo il tuo rifiuto dei cookie.*

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

**Website:** [nicolobachiorri.github.io/afterNO](https://nicolobachiorri.github.io/afterNO/), with a live demo of the popup.

**Status:** available on the [Chrome Web Store](https://chromewebstore.google.com/detail/afterno/ancbhlnmgciehgahppbppeelmcdnjdjk) and [Firefox Add-ons](https://addons.mozilla.org/addon/afterno/). It also works on Edge, Brave, Vivaldi and Opera.

## What it shows

Open the extension's popup on any site (it shows nothing until you ask):

- **Your choice**: read from the site's consent signal (the IAB TCF standard, used by
  most news and ad-funded sites) or, when there is none, from the button you clicked
  (recognised in eight EU languages: Italian, English, French, German, Spanish,
  Portuguese, Dutch, Polish).
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

Cookies of **your own account** are kept apart. If you are signed in to Google (or
Facebook, Instagram, LinkedIn, X), the browser sends your account cookies to that
service whenever a page loads its content, whatever you chose in the banner. The popup
says so as information and marks those cookies in the list, but does not count them
against the site: they exist because you are signed in, not because of the site. The
service's other cookies, set for everyone, still count.

The same rule applies to **"legitimate interest"**. When the TCF signal says some
purposes stay active without consent, the popup names them ("measure advertising
performance"...) as information. It is what the site declares it may do, not something
the browser observes, so it does not change the conclusion.

One more case: a **visitor ID shared by a suite of tools**. Adobe Experience Cloud
sets one ID (`AMCV_…`, `s_ecid`) that its analytics and its advertising tools both
read. The database labels it marketing, but from outside one cannot tell which use it
serves. On the site's own domain the popup shows it as information, not against the
site; on another company's domain it is still a company that can recognise you.

## What it cannot see

An extension sees what the browser sees. It does not see, and does not claim to see:

- recognition **without cookies** (browser fingerprinting);
- other browser storage (localStorage, IndexedDB), which sites can also use to keep an identifier;
- data passed **between companies' servers**;
- **what a company does** with a cookie: purposes are declared, not observable;
- cookies whose names are **not in the database**: shown as "unclassified", or as
  "likely identifiers" when they behave like one.

## How accurate is it?

Measured on sites **the extension had never been tried on**, drawn at random from the
[Tranco](https://tranco-list.eu) list (ID ZJ8PG) with a fixed seed: 40 Italian sites,
then twice 40 sites of eight other EU countries (Germany, Austria, France, Spain,
Portugal, the Netherlands, Poland, Ireland; five each per round, visited with the
language of their country), each round with the version corrected after the previous one. For each site a robot opened the home page with the extension installed,
clicked "Reject" and saved the extension's verdict and, independently, the raw data
(every cookie, every site contacted after the click, the TCF signal). The method was
written down before the results: [quality/PROTOCOL.md](quality/PROTOCOL.md).

Three different numbers, not to be mixed up:

- **Rejection recorded**: of the sites with a free reject button, how often the
  extension noticed the click. If it does not notice, it cannot check anything.
- **Right verdict, when recorded**: of the sites where the rejection was recorded,
  how many conclusions were right.
- **Stability**: the same sites visited again with the same version: is the answer
  the same?

| | Italy | EU, first round | EU, second round |
| --- | --- | --- | --- |
| Sites with a free reject button | 24 of 40 | 19 of 40 | 24 of 40 |
| **Rejection recorded** (95% Wilson interval) | **22 of 24: 92% (74-98%)** | **14 of 19: 74% (51-88%)** | **19 of 24: 79% (60-91%)** |
| **Right verdict, when recorded** | **22 of 22: at least 85%** | **14 of 14: at least 78%** | **19 of 19: at least 83%** |
| False alarms ("only partly respected" when the data say otherwise) | 0 | 0 | 0 |
| Problems not seen ("seems respected" when the data show a tracker) | 0 | 0 | 0 |
| Rejection recorded where there was none | 0 | 0 | 1 |
| Agreement of the second judge on the conclusion | 21 of 22 | 14 of 14 | 19 of 19 |
| **Stability**: same conclusion on a second visit | not measured on this version | **14 of 14** (next day) | **19 of 19** (same day, one hour later: an upper bound) |

What to keep in mind:

- **Why this table used to show only 100%.** Until 10 November 2026 the table counted
  only the sites where the robot clicked "Reject", and the robot looked for the button
  with the same phrases as the extension (`quality/robot_labels.py`, protocol
  modification 21). When the extension did not know a phrase, the robot did not click
  either, and the site was filed as "nothing to check" instead of as an error of the
  extension, against the rule the protocol had set on 29 October (modification 4).
  An external review pointed this out; the row "Rejection recorded" counts those sites
  as errors. The verdict accuracy is unchanged: it is conditional on the rejection
  being recorded. The next round will use a robot that finds the button independently
  of the extension.
- **Rejections not recorded.** Italy (order 98 and 132): two banners where the X
  counts as a refusal by their own text; the extension did not recognise an X (it does
  from 0.1.1). A third banner, in German (order 122), had a reject the robot of that
  round could not click; it is not counted, because we did not check what the
  extension would have done. EU, first round: "Alle Dienste ablehnen", "Non merci",
  "Odmawiam", "Nie zgadzam się", "I Do Not Accept", fixed before the second round.
  EU, second round: "Akceptuj tylko niezbędne" ("accept only the necessary ones")
  would have been read as an *acceptance*; two word orders were not known; one banner
  names its button "Cookies : Deny all cookies"; and on one site a link "ablehnen,
  ändern oder widerrufen", which opens the settings, was recorded as a rejection that
  never happened (protocol, modifications 24-35). These are fixed in the published
  version, which is not yet measured on new sites.
- **Small samples.** 19 to 24 sites per round give wide intervals.
- **The sites without a rejection to check.** Italy: 7 offered only "accept" or
  "reject and subscribe", 6 showed no banner, 2 blocked the robot. EU, first round: 9
  without a free reject, 8 without a banner, 3 blocked the robot, 1 with toggles and
  "save" only. Second round: 10 without a free reject, 6 without a banner.
- **Who judged.** The verdicts were judged against the raw data by Claude, the AI that
  wrote most of the code: a conflict of interest, stated here. A human judge did two
  rounds on the Italian sample, but in six cases the answers contradicted the written
  rules, and on the project lead's decision the human judgement was set aside
  (protocol, modification 9). Gemini (a model from another company) judged the same
  sites independently. Both judges read a review page where the criteria and the
  comparison with the extension are already computed (`quality/build_review.py`):
  their agreement shows that the TypeScript extension and the Python review apply the
  same rules, not that the rules capture every case of a rejection not respected.
  Cohen's κ is not informative here, because the judges gave the same answer to almost
  every site. In Italy Gemini disagreed on one conclusion: on docpeter.it it called a
  false alarm the warning about a Shopify cookie (`_shop_app_essential`, readable by
  other sites, valid a year), which Claude judged correct by the protocol's rules. In
  the first EU round it caught a wrong label Claude had missed: Segment's
  `ajs_anonymous_id` shown as "Trustpilot", now corrected. The next round will add an
  external human judge, blind, on raw data without the precomputed comparison.
- **A new browser profile for each site.** The robot has never visited other sites, so
  trackers have no cookies of it yet. The measurement says whether the extension reads
  correctly the data in front of it; it does not say how often a real user, whose
  browser already holds trackers' cookies, would see "only partly respected".
- **If you had accepted before.** When you reject on a site where you had accepted
  earlier, the cookies saved then are still in the browser and still count in the
  verdict, because a cookie that stays can still be read. The popup also shows what
  was there at the moment of your choice. This case, the most common for a real user,
  is not measured: the robot starts each site from a new profile.
- **From Italy.** The robot connects from Italy: a site may choose its banner from the
  address, not from the browser's language. In practice the banners came in the
  language of each country.
- **Chromium only.** Firefox partitions third-party cookies by site and blocks known
  trackers, while the extension reasons with Chrome's rules: on Firefox the verdict may
  differ (probably "respected" more often, partly thanks to the browser). Not measured
  yet.
- **Versions.** The measured versions are the commits of each round (see the run
  folders); the version published in the stores includes fixes made after the last
  round. From 0.1.1 every release has its own version number and a git tag.
- **Earlier rounds.** The previous version, on another 40 new Italian sites, gave 15 of
  19 correct (79%), with 3 choices not recorded; those defects were fixed before these
  measurements. A first version gave 14 of 25 (56%). All rounds, data and judgments
  are in [quality/](quality/).

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

The cookie database is kept up to date by a GitHub Action
(`.github/workflows/update-cookie-db.yml`): once a month it downloads the Open Cookie
Database and, if it changed, rebuilds the database, runs the tests and opens a pull
request to review. Nothing is merged automatically. To do it by hand, put a newer CSV in
`divergence_work_space/open-cookie-database.csv` and run `npm run db`.

## Project layout

```
extension/            the browser extension (WXT, TypeScript, Manifest V3)
  entrypoints/        background, content script (banner choice), popup
  lib/                the rules: classification, verdict, texts; pure and unit-tested
  public/             translations (_locales/), icons, cookie database (JSON)
tools/                build_cookie_db.py: CSV -> JSON (with divergence_work_space/overrides.csv)
quality/              the accuracy measurement: PROTOCOL.md, samples, robot, judgments, runs/
divergence_work_space/  step 1: the measurement that motivated the project
store/                store listing texts (LISTING.md), screenshots and the script that takes them
docs/                 the website (GitHub Pages): one page, no cookies, no third-party requests
design/               icon source
.github/workflows/    tests on every push; monthly update of the cookie database
```

## How it was made

The idea, the product decisions (what to build and what to leave out, the cautious
wording, the legal caution) and the testing on real sites are by the author.
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

## Contact

Bugs and questions: open an issue on GitHub, or write to afterno.extension@gmail.com.

## Licence

Apache License 2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE). You may use, modify
and redistribute this code, also commercially, as long as you keep the notices.

## Disclaimer

The extension gives an automatic indication based on what the browser observes. It may
be incomplete or wrong and is not a legal assessment.
