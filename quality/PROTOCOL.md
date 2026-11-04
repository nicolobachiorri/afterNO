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

**1 novembre 2026, dopo la visita A e prima del giudizio definitivo.**

5. iue.it non si carica (certificato non valido): sostituito da feltrinellieditore.it
   secondo la regola «non risponde». italotreno.it reindirizza a italotreno.com:
   sostituito come previsto dalla modifica 3. Registrati in `select_sites.py`.
6. *Giudizio, prima tornata.* La pagina di giudizio mostrava solo lo screenshot fatto
   dopo il clic e il ricaricamento, senza spiegarlo: un banner assente, che indica un
   clic riuscito, poteva essere letto come «nessun banner». Inoltre permetteva risposte
   alle domande 2-4 anche per i siti non misurabili e «discutibile» senza nota.
7. *Giudizio, seconda tornata.* La pagina è stata corretta (indicazione accanto alla
   domanda 1 su cosa ha fatto il robot e cosa significa lo screenshot; domande 2-4
   solo per i siti misurabili; nota obbligatoria per «discutibile» e «altro»;
   confronto tra i siti terzi che soddisfano i criteri e quelli nominati
   dall'estensione). Il giudice umano rigiudica i siti toccati da questi problemi:
   4, 8, 10, 19, 22, 27, 34 (misurabilità), 9, 16, 17, 21, 37 («discutibile» senza nota),
   5, 7, 15, più feltrinellieditore.it. Per 5, 7 e 15 lo sviluppatore ha segnalato
   prima della seconda tornata un fatto verificabile nei dati grezzi (cookie di un
   tracker legati a un percorso, non letti dall'estensione): il giudizio su questi tre
   non è quindi cieco, e lo si dichiara.
8. *Secondo giudice.* Un modello di IA (Gemini) ha compilato la pagina della prima
   tornata leggendone solo il testo, senza vedere gli screenshot. Il suo giudizio non
   sostituisce quello umano: si usa come secondo giudice per misurare l'accordo, con
   questo limite dichiarato.
9. *Giudici definitivi della visita A.* Il giudice umano ha completato due tornate,
   ma in sei casi le risposte contraddicevano regole scritte (per esempio
   «corretta» dove i dati mostrano un tracker non visto dall'estensione). Su
   decisione del responsabile del progetto, il giudizio umano è stato messo da parte
   e il giudizio principale è stato affidato a **Claude, il modello di IA che ha
   scritto il codice dell'estensione**: un conflitto di interessi che si dichiara.
   Per controllarlo, **Gemini** (modello di un'altra azienda, che non ha scritto il
   codice) è il secondo giudice: ha giudicato prima e in modo indipendente, sul solo
   testo della pagina. L'accordo tra i due si riporta con i risultati (`summary.md`).
   I file del giudizio umano non fanno parte dei risultati.

**1 novembre 2026, dopo il giudizio della visita A.**

10. *Correzioni e nuove visite.* Dalla visita A sono emersi tre difetti, corretti
    nell'estensione: segnale TCF che elenca solo le finalità con consenso (elenco
    vuoto dopo un rifiuto); nome interno del pulsante Didomi
    («continue-without-agreeing») letto come accettazione; cookie dei tracker
    legati a un percorso, non letti. Verifica fuori campione su automobile.it e
    casa.it (Didomi): rifiuto ora registrato.
    Cambia quindi il significato delle visite successive:
    - **visita B**: versione corretta, stessi 40 siti. Serve a verificare che le
      correzioni funzionino dove servivano. Il miglioramento rispetto alla visita A
      è **ottimistico**, perché le correzioni sono state ricavate da questi siti, e
      non si pubblica come accuratezza;
    - **visite C1 e C2**: versione corretta su un campione nuovo di 40 siti (le
      riserve Tranco successive, con le stesse regole di sostituzione), visitato due
      volte in momenti diversi. L'accuratezza da pubblicare e la stabilità vengono da
      queste visite. La stabilità prevista per le visite A e B si misura quindi tra
      C1 e C2.

**1 novembre 2026, prima della visita C1.**

11. *Campione C* (`select_sample_c.py`, `sites_C.csv`): le prime 40 riserve libere
    della stessa lista Tranco ZJ8PG mescolata con lo stesso seme, dalla posizione 45.
    Sostituiti prima della visita, per nome: lottomatica.it e betflag.it (scommesse,
    riservati agli adulti). Le altre regole di sostituzione si applicano alla visita
    C1. Stessa versione dell'estensione della visita B. Giudizio con lo stesso metodo
    della visita B (Claude, poi Gemini come secondo giudice), registrato prima di
    vedere i risultati.

12. *Visita C1, sostituzioni.* Non si caricano: polymoon.it, maggiolicloud.it,
    val.it (nome non trovato), tiristorantemipizzeria.it (errore del server),
    mvmnet.it ed e-pal.it (certificato non valido), qcom.it (connessione
    interrotta); sostituiti dalle riserve successive (`select_sample_c.py`).
    *Limite:* gli indirizzi sono costruiti come `https://www.<dominio>` per i domini
    di secondo livello, mentre la lista Tranco elenca il dominio nudo; alcuni dei
    siti «non trovati» potrebbero rispondere senza `www.`. La regola si applica
    all'indirizzo costruito, come per tutti i siti dei campioni A e C.

13. *Visita C2.* Fatta lo stesso giorno della C1, circa un'ora dopo, su decisione
    del responsabile del progetto. Con un intervallo così breve la variabilità della
    pubblicità è probabilmente sottostimata: la stabilità misurata è un limite
    superiore. Stessa versione dell'estensione, stesso campione (inclusi i
    sostituti). La stabilità si calcola sulla conclusione dell'estensione nelle due
    visite, senza un nuovo giudizio.

**2 novembre 2026, dopo le visite C1 e C2.**

14. *Errore di misura del robot.* Il robot conta come «sito contattato» anche le
    richieste che il browser serve dalla propria cache, che non raggiungono il sito
    terzo e non gli inviano cookie; l'estensione, che osserva solo le richieste di
    rete, non le conta. Scoperto con `diagnose.py` su borsaitaliana.it (C1, sito 89):
    dopo il ricaricamento lo script di blendee.com arriva dalla cache. Il giudizio di
    Claude sul sito 89 è corretto da «sbagliata: problema non visto» a «corretta»
    (nota nel file del giudizio). Il giudizio di Gemini resta com'è stato dato.
    Le visite A e B non ne risentono: i tre «problemi non visti» della visita A
    riguardano siti terzi presenti nell'elenco dell'estensione stessa, quindi
    contattati in rete. Il robot va corretto prima di misure future.
15. *Correzioni dopo il campione C.* Dalla diagnosi dei tre siti con scelta non
    registrata in C1 (arera, cloud.it, salonelibro) e di agriturismo (visita B):
    contenitori delle piattaforme di consenso riconosciuti dal nome (Cookiebot ha
    testi oltre il limite di lunghezza), pulsanti di solo testo, copia di sicurezza
    della scelta per i banner che ricaricano la pagina. I risultati di C1 e C2
    valgono per la versione precedente a queste correzioni.

16. *Robot corretto (modifica 14).* `measure.py` legge dal protocollo DevTools di
    Chrome quali risposte arrivano dalla cache del browser (memoria, disco,
    prefetch) e non conta come contatti le richieste così servite. Le elenca a parte
    nei dati grezzi (`third_party_hosts_served_from_cache_after_click`) e nella
    pagina di giudizio, perché chi giudica le veda. Limite: la sessione DevTools copre
    la pagina e gli iframe nel suo processo; una richiesta servita dalla cache dentro
    un iframe di un altro sito resta contata come contatto. L'errore che resta va
    quindi nella direzione di più «problemi non visti», non di meno.
17. *Correzioni del 2 novembre 2026, dopo la prova manuale.* (a) I cookie
    dell'account dell'utente su un servizio (Google, Facebook, Instagram, LinkedIn, X)
    non contano più contro il sito: sono mostrati come informazione. (b) Il
    «legittimo interesse» dichiarato nel segnale TCF è un'informazione, con le
    finalità nominate, e non cambia la conclusione. In una misura con profilo nuovo
    (a) non ha effetto, perché il robot non è collegato a nessun account; (b) sì.
18. *Campione D* (`select_sample_d.py`, `sites_D.csv`). Misura la versione con le
    correzioni delle modifiche 15 e 17, con il robot della modifica 16. Stessa
    regola del campione C: le prime 40 riserve libere dopo il campione C, nell'ordine
    già fissato dal seme. Sostituito prima della visita, dal solo nome: netwin.it
    (gioco d'azzardo). Visita D1 con lo stesso procedimento di C1; giudice
    principale Claude, secondo giudice Gemini, come per C1. I risultati pubblicati
    nel README diventano quelli di D1; quelli di C1 restano nella cartella e nel
    README come misura della versione precedente.
19. *Visita D1, sostituzioni.* Non si caricano: ergonet-dns.it, serverkeliweb.it,
    bismuth.it, sbito.it (nome non trovato), yhoo.it (certificato non valido),
    aosp.bo.it (tempo scaduto in due tentativi); sostituiti dalle riserve successive
    (`select_sample_d.py`). leteledimargi.it, scaduto al primo tentativo, si è
    caricato al secondo: un tempo scaduto riceve un secondo tentativo prima della
    sostituzione. Stesso limite sugli indirizzi `www.` della modifica 12.
20. *Visita D1, note.* villasarina.it si è rivelato alla visita un elenco di casinò
    online: le regole ne chiederebbero la sostituzione, ma non era misurabile
    (nessun banner) e non cambia alcun risultato; resta nel campione, dichiarato.
    Il secondo giudice (Gemini) ha restituito i giudizi come script per la pagina
    di giudizio (`gemini-code-*.js`, conservato) invece che come file esportato;
    convertito in `judgments_D1_gemini.csv` senza modifiche. Il kappa sulla
    conclusione (0,00) non è informativo: il giudice principale ha dato la stessa
    risposta a tutti i siti misurabili. La pagina di giudizio mostra l'etichetta del
    database secondo la sola regola del nome, non quella usata dall'estensione
    (che scarta i prefissi generici fuori dal sito proprietario): sul sito 139 il
    secondo giudice ha letto «Analytics, Marfeel» per `_shop_app_essential`. Da
    allineare prima di misure future.

**3 novembre 2026.**

21. *Pulsanti in altre lingue.* Il robot dello step 1 riconosceva il rifiuto solo in
    italiano e inglese (a D1 un banner tedesco, innn.it, è risultato non misurabile per
    questo). Da questa data il robot usa le formule di rifiuto di otto lingue
    dell'UE (italiano, inglese, francese, tedesco, spagnolo, portoghese, olandese,
    polacco), le stesse dell'estensione, in `robot_labels.py`; anche le parole che
    indicano un rifiuto a pagamento sono estese. Il file dello step 1 non cambia:
    `measure.py` sostituisce le sue regole al momento dell'uso. Le visite A–D1 restano
    misurate con le regole di allora.

22. *Identificativi condivisi (3 novembre 2026).* Sul dominio del sito, i cookie di
    Adobe Experience Cloud `AMCV_…` e `s_ecid` (un identificativo che il database
    descrive come condiviso tra gli strumenti Adobe, statistiche comprese) diventano
    un'informazione e non contano contro il sito. Sul dominio di un terzo restano un
    tracker. Motivo: bahn.de, e in precedenza trenitalia e rfi.it, risultavano «solo in
    parte» per questi soli cookie, giudicati «discutibili». Le visite A–D1 restano
    misurate con le regole di allora.

23. *Campione E: siti di altri paesi dell'UE (3 novembre 2026, prima di qualunque
    visita).* `select_sample_e.py`, `sites_E.csv`. Misura la versione con le
    modifiche 21 e 22 dove le otto lingue contano davvero. Otto domini nazionali, uno
    per lingua oltre all'italiano: .de, .at, .fr, .es, .pt, .nl, .pl, .ie. Per
    ciascuno, i primi 500 domini della lista Tranco ZJ8PG, mescolati con lo stesso
    seme; i primi 5 sono il campione, gli altri riserve dello stesso paese. Esclusi i
    siti provati a mano e i due usati come prova del robot (bahn.de, decathlon.fr).
    Ogni sito si visita con lingua e fuso orario del suo paese; il popup resta in
    italiano per il giudice. Sostituiti prima della visita, dal solo nome:
    casino-portugal.pt (gioco d'azzardo), hdfilmcehennemi.nl (film pirata).
    Due visite della stessa versione, E1 ed E2, ad almeno un giorno di distanza:
    E1 misura l'accuratezza (giudice principale Claude, secondo giudice Gemini, come
    per D1), E1 contro E2 la stabilità. Limite dichiarato: il robot si collega
    dall'Italia, e un sito può scegliere lingua e banner dall'indirizzo IP invece che
    dalla lingua del browser.

**4 novembre 2026.**

24. *Visite E1 ed E2.* E1: t-ipnet.de non si carica (nome non trovato), sostituito
    dalla riserva aerzteblatt.de. Misurabili 14 su 40, tutte corrette per il giudice
    principale (almeno 78%, Wilson). Cinque siti hanno un rifiuto gratuito che il
    robot non riconosce, e con le stesse parole nemmeno l'estensione: «Alle Dienste
    ablehnen», «Non merci», «Odmawiam», «Nie zgadzam się», «I Do Not Accept»;
    contati come «clic non riuscito». E2 il giorno dopo con la stessa build:
    stessa scelta registrata e stessa conclusione in 14 siti su 14; il robot ha
    cliccato in modo diverso su un sito, 3cx.at, che in E2 ha mostrato un banner
    con «Alle ablehnen» invece della sola riga informativa di E1 (decisione del
    sito, non dell'estensione). Solo dopo E2 le parole sono state estese, nella
    stessa forma nell'estensione e nel robot: parole in mezzo («alle … ablehnen»),
    «I» prima del verbo inglese, «no grazie» nelle otto lingue, «odmawiam» e «nie
    zgadzam się». I risultati di E1 ed E2 restano quelli della versione precedente;
    la correzione si misura su un campione nuovo.
