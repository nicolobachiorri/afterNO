# Visita A: risultati

Giudice principale: **claude**. Calcolato da `analyze.py` sui file di questa cartella.

Siti nel campione: 40. Misurabili: **25**.

Non misurabili, per motivo: banner senza rifiuto 11, altro 3, nessun banner 1.

## Conclusioni (siti misurabili)

| Conclusione | Siti | Quota | Intervallo 95% (Wilson) |
| --- | --- | --- | --- |
| corretta | 14 | 56% | 37%–73% |
| discutibile | 1 | 4% | 1%–20% |
| sbagliata: falso allarme | 0 | 0% | 0%–13% |
| sbagliata: problema non visto | 3 | 12% | 4%–30% |
| errore: scelta non registrata | 7 | 28% | 14%–48% |

Punti della lista, nei 18 siti in cui la scelta è stata registrata: tutti corretti 12, almeno uno impreciso 3, almeno uno sbagliato 3.

## Accordo con il secondo giudice (gemini)

| Domanda | Siti | Accordo osservato | Kappa di Cohen |
| --- | --- | --- | --- |
| Misurabile sì/no | 40 | 100% | 1.00 |
| Conclusione (siti misurabili per entrambi) | 25 | 96% | 0.93 |

- sito 9 (https://www.trenitalia.com): claude «discutibile», gemini «corretta»
