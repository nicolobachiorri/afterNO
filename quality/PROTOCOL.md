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
- **20 domini .it dalla lista Tranco**, estratti a caso tra i primi 2000 domini .it,
  esclusi gli stessi siti e quelli dello step 1. L'identificativo della lista Tranco
  usata è scritto in `sites.csv`.

**Sostituzioni.** Un sito Tranco si sostituisce con il successivo della lista
(ruolo `reserve`) solo se la sua pagina principale non è una pagina per visitatori:
non risponde, è un servizio tecnico (CDN, API, statistiche), richiede l'accesso, o è
riservata agli adulti. Ogni sostituzione si registra con il motivo. I siti dello step
1 non si sostituiscono.

## Procedura per ogni sito

Profilo del browser nuovo per ogni sito. Due visite indipendenti (A e B).

1. Aprire la pagina principale con l'estensione installata (versione di sviluppo,
   identica a quella da pubblicare salvo l'accesso di prova al popup).
2. Cercare il banner e cliccare il pulsante di rifiuto con le regole dello step 1
   (pulsante «Rifiuta» o equivalente; mai un pulsante «Rifiuta e abbonati»).
3. Attendere 5 secondi, ricaricare la pagina, attendere altri 10 secondi.
4. Salvare: verdetto dell'estensione (punti e conclusione), screenshot del popup,
   screenshot della pagina, e i **dati grezzi**: tutti i cookie del browser con dominio,
   scadenza, SameSite e partizione; i domini contattati dalla pagina dopo il clic;
   il segnale TCF se presente.

## Siti non misurabili

Un sito è **non misurabile** se: non compare un banner; il banner non ha un rifiuto
(solo «accetta» o «accetta o abbonati»); il robot non riesce a cliccare; il sito
blocca il robot; l'estensione non registra la scelta. Si contano e si riportano con
il motivo, ma non entrano nel calcolo dell'accuratezza. L'ultimo caso (scelta non
registrata) è anche un difetto dell'estensione e si riporta come tale.

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
- *sbagliata*: dice «sembra rispettato» mentre i dati grezzi mostrano un sito terzo con
  un cookie di marketing o identificativo, non partizionato, valido almeno 30 giorni,
  inviato dopo il rifiuto; oppure dice «solo in parte» e l'unico motivo è un punto
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

## Cosa si pubblica

I numeri, gli intervalli, la lista dei siti, i motivi dei non misurabili e i difetti
trovati. Nel README, una frase con la misura principale e il link a questa cartella.

## Modifiche al protocollo

(nessuna)
