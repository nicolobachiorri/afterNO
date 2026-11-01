# Visita C1: risultati

Giudice principale: **claude**. Calcolato da `analyze.py` sui file di questa cartella.

Siti nel campione: 40. Misurabili: **19**.

Non misurabili, per motivo: banner senza rifiuto 11, nessun banner 8, altro 2.

## Conclusioni (siti misurabili)

| Conclusione | Siti | Quota | Intervallo 95% (Wilson) |
| --- | --- | --- | --- |
| corretta | 14 | 74% | 51%–88% |
| discutibile | 1 | 5% | 1%–25% |
| sbagliata: falso allarme | 0 | 0% | 0%–17% |
| sbagliata: problema non visto | 1 | 5% | 1%–25% |
| errore: scelta non registrata | 3 | 16% | 6%–38% |

Punti della lista, nei 16 siti in cui la scelta è stata registrata: tutti corretti 15, almeno uno sbagliato 1.

## Accordo con il secondo giudice (gemini)

| Domanda | Siti | Accordo osservato | Kappa di Cohen |
| --- | --- | --- | --- |
| Misurabile sì/no | 40 | 98% | 0.95 |
| Conclusione (siti misurabili per entrambi) | 19 | 95% | 0.87 |

Disaccordi sulla misurabilità: siti 56.
- sito 48 (https://www.rfi.it): claude «discutibile», gemini «corretta»
