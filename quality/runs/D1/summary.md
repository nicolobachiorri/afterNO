# Visita D1: risultati

Giudice principale: **claude**. Calcolato da `analyze.py` sui file di questa cartella.

Siti nel campione: 40. Misurabili: **22**.

Non misurabili, per motivo: banner senza rifiuto 7, nessun banner 6, altro 3, robot bloccato 2.

## Conclusioni (siti misurabili)

| Conclusione | Siti | Quota | Intervallo 95% (Wilson) |
| --- | --- | --- | --- |
| corretta | 22 | 100% | 85%–100% |
| discutibile | 0 | 0% | 0%–15% |
| sbagliata: falso allarme | 0 | 0% | 0%–15% |
| sbagliata: problema non visto | 0 | 0% | 0%–15% |
| errore: scelta non registrata | 0 | 0% | 0%–15% |

Punti della lista, nei 22 siti in cui la scelta è stata registrata: tutti corretti 22.

## Accordo con il secondo giudice (gemini)

| Domanda | Siti | Accordo osservato | Kappa di Cohen |
| --- | --- | --- | --- |
| Misurabile sì/no | 40 | 100% | 1.00 |
| Conclusione (siti misurabili per entrambi) | 22 | 95% | 0.00 |

- sito 139 (https://www.docpeter.it): claude «corretta», gemini «sbagliata: falso allarme»
