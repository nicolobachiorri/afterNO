# Visita G1: risultati

Giudice principale: **claude**. Calcolato da `analyze.py` sui file di questa cartella.

Siti nel campione: 40. Misurabili: **17**.

Non misurabili, per motivo: nessun banner 9, banner senza rifiuto 6, robot bloccato 4, altro 3, clic non riuscito 1.

## Conclusioni (siti misurabili)

| Conclusione | Siti | Quota | Intervallo 95% (Wilson) |
| --- | --- | --- | --- |
| corretta | 16 | 94% | 73%–99% |
| discutibile | 0 | 0% | 0%–18% |
| sbagliata: falso allarme | 0 | 0% | 0%–18% |
| sbagliata: problema non visto | 1 | 6% | 1%–27% |
| errore: scelta non registrata | 0 | 0% | 0%–18% |

Punti della lista, nei 17 siti in cui la scelta è stata registrata: tutti corretti 16, almeno uno sbagliato 1.

## Accordo con il secondo giudice (gemini)

| Domanda | Siti | Accordo osservato | Kappa di Cohen |
| --- | --- | --- | --- |
| Misurabile sì/no | 40 | 92% | 0.85 |
| Conclusione (siti misurabili per entrambi) | 17 | 94% | 0.48 |

Disaccordi sulla misurabilità: siti 3513, 6013, 6515.
- sito 147 (https://www.concorsando.it): claude «sbagliata: problema non visto», gemini «discutibile»
