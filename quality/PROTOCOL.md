# Misura della qualità: protocollo

*Scritto il 29 ottobre 2026, prima di qualunque risultato. Il commit git che lo
contiene ne fissa la data: modifiche successive restano visibili nella cronologia e
vanno motivate in fondo a questo file.*

## Domanda

Sui siti reali, quanto spesso l'estensione **interpreta correttamente quello che il
browser osserva** dopo un rifiuto?

Non si misura se il sito viola la legge: nessuno strumento lo sa. Si misura se la
lista di controllo e la conclusione dicono il vero rispetto ai dati grezzi raccolti
nella stessa visita.

## Campione

40 siti, estratti da `select_sites.py` con seme fisso (20261029):

- **20 dallo step 1** (`divergence_work_space/sites.csv`), esclusi i siti provati a
  mano durante lo sviluppo: ilmeteo.it, ikea.com, corriere.it, ilfattoquotidiano.it
  (oltre a zara.com, pinterest.com, thefork.it, che non sono nella lista).
- **20 domini .it dalla lista Tranco ZJ8PG**, estratti a caso tra i primi 2000 domini
  .it, esclusi gli stessi siti e quelli dello step 1. Poiché i domini .it sono rari
  nelle prime posizioni, i primi 2000 arrivano fino alla posizione 230.000 circa: il
  campione contiene molti siti piccoli (giornali locali, enti, negozi).

**Sostituzioni.** Un sito Tranco si sostituisce con la prima riserva libera della
lista (ruolo `reserve`), registrando il motivo in `sites.csv`, se la sua pagina
principale:
- non risponde o non è una pagina per visitatori (servizio tecnico: CDN, API,
  statistiche);
- richiede l'accesso per mostrare qualunque contenuto;
- è riservata agli adulti (contenuti per adulti, scommesse);
- **reindirizza a un sito già nel campione**.

I siti dello step 1 non si sostituiscono. Sostituzioni già applicate prima della
misura: sunbet.it → cognomix.it (scommesse); resmush.it → milanotoday.it (servizio
tecnico). italotreno.it si controlla alla prima visita (possibile reindirizzamento a
italotreno.com, già nel campione).

## Procedura per ogni sito

Chromium, profilo del browser nuovo per ogni visita. Due visite indipendenti (A e B),
in giorni o orari diversi.

1. Aprire la pagina principale con l'estensione installata (versione costruita per la
   pubblicazione, più il solo accesso di prova al popup, che nella versione pubblicata
   non esiste).
2. Cercare il banner e cliccare il pulsante di rifiuto con le regole dello step 1
   (pulsante «Rifiuta» o equivalente; mai un pulsante «Rifiuta e abbonati»).
   Registrare se è servito il clic del mouse simulato o il clic via JavaScript.
3. Attendere 5 secondi, ricaricare la pagina, attendere altri 10 secondi.
4. Salvare: verdetto dell'estensione (punti e conclusione), screenshot del popup,
   screenshot della pagina, e i **dati grezzi**, raccolti dal robot in modo
   indipendente dall'estensione:
   - tutti i cookie del browser, con dominio, scadenza, SameSite e partizione;
   - i domini contattati dalla pagina dopo il clic, con l'ora;
   - il segnale TCF, se presente.

## Siti non misurabili

Un sito è **non misurabile** se: non compare un banner; il banner non ha un rifiuto
(solo «accetta» o «accetta o abbonati»); il robot non riesce a cliccare; il sito
blocca il robot. Si contano e si riportano con il motivo, ma non entrano nel calcolo
dell'accuratezza.

Se invece il clic avviene (il banner scompare) ma **l'estensione non registra la
scelta**, il sito è misurabile e conta come errore dell'estensione.

## Giudizio (visita A)

Il giudice vede i dati grezzi e lo screenshot del popup. Per ogni sito misurabile:

**Per ogni punto della lista di controllo:**
- *corretto*: conteggi e nomi corrispondono ai dati grezzi;
- *impreciso*: il senso è giusto ma un conteggio, un nome o un'etichetta no;
- *sbagliato*: afferma qualcosa che i dati grezzi contraddicono.

**Per le etichette:** per i cookie nominati nella lista, l'attribuzione (azienda e
categoria) è plausibile? Un'omonimia evidente (come `CC` su un sito che non è
Microsoft) conta come *etichetta errata*.

**Per la conclusione:**
- *corretta*: segue da punti corretti;
- *sbagliata, problema non visto*: dice «sembra rispettato» mentre i dati grezzi
  mostrano un sito terzo, **contattato dopo il clic**, con un cookie classificato come
  marketing o con la forma di un identificativo, **leggibile da altri siti**
  (SameSite=None), **non partizionato**, valido almeno 30 giorni;
- *sbagliata, falso allarme*: dice «solo in parte» e l'unico motivo è un punto
  *sbagliato* o un'etichetta errata;
- *discutibile*: tecnicamente coerente con i dati, ma basata su un'etichetta su cui
  persone ragionevoli potrebbero non essere d'accordo.

Le regole si applicano come sono scritte. Un caso che non rientra nelle regole si
annota e si discute alla fine, senza cambiare le regole a metà.

## Misure

- **Principale:** quota di siti misurabili con conclusione *corretta* (visita A), con
  intervallo di confidenza di Wilson al 95%.
- **Secondarie:** quota di conclusioni *sbagliate*, separate in falsi allarmi e
  problemi non visti; quota di punti *sbagliati* o *imprecisi*; quota di etichette
  errate tra i cookie nominati; **stabilità**, cioè quota di siti con la stessa
  conclusione nelle visite A e B; quota di siti non misurabili, per motivo.
- **Facoltativa:** un secondo giudice ripete il giudizio su 10 siti estratti a caso;
  accordo con il kappa di Cohen.

## Limiti dichiarati

- **Solo Chromium.** Firefox divide i cookie dei tracker per sito e ne blocca molti:
  i risultati non valgono automaticamente per Firefox.
- **Profilo nuovo.** Un utente reale ha cookie accumulati visitando altri siti; un
  profilo nuovo no. Su un profilo vero l'estensione vedrebbe in genere più tracker.
  Questo non cambia ciò che si misura (se l'interpretazione è corretta), ma i numeri
  sui tracker trovati non vanno letti come quelli di un utente tipico.
- **Un solo giudice** di base, che conosce il progetto: per questo le regole sono
  scritte prima e il secondo giudice è previsto.
- **40 siti:** l'intervallo di confidenza sarà largo (circa ±12 punti percentuali).

## Cosa si pubblica

I numeri, gli intervalli, la lista dei siti, i motivi dei non misurabili e i difetti
trovati. Nel README, una frase con la misura principale e il link a questa cartella.

## Modifiche al protocollo

**29 ottobre 2026, prima di qualunque misura.**

1. Identificativo della lista Tranco: **ZJ8PG**.
2. Sostituzioni applicate secondo le regole già scritte: sunbet.it (scommesse) →
   cognomix.it; resmush.it (servizio tecnico) → milanotoday.it.
3. Regola aggiunta: si sostituisce un sito Tranco che reindirizza a un sito già nel
   campione (caso italotreno.it / italotreno.com).
4. Precisazioni dopo una rilettura critica, prima di qualunque misura:
   - la regola del *problema non visto* parlava di cookie «inviato dopo il rifiuto»,
     che il robot non può osservare direttamente; ora dice «sito terzo contattato
     dopo il clic» con un cookie «leggibile da altri siti», entrambi osservabili;
   - un sito in cui il clic avviene ma l'estensione non registra la scelta era
     escluso come non misurabile: ora conta come errore dell'estensione, perché
     escluderlo nasconderebbe proprio un suo difetto;
   - le due visite si fanno in momenti diversi, perché due visite consecutive
     sottostimerebbero la variabilità della pubblicità;
   - aggiunta la sezione dei limiti dichiarati.
