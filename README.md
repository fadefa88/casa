# Casa 5B — Homestyler fedele (fix v4)

Pacchetto statico pronto per GitHub Pages.

## Modifiche rispetto alla versione precedente

- `43352ParametricOpening-43352_413_413_143352` forzato completamente bianco.
- Tutte le `door/entry/single swing door` forzate completamente bianche.
- Le 2 `door/pocket door` sono state forzate completamente bianche e corrette di scala (il modello sorgente era 10x troppo piccolo).
- La `table/desk` è stata ingrandita per risultare più fedele al progetto originale.
- I piani restano uno sopra l'altro; `Primo piano` e `Secondo piano` nascondono l'altro livello.

## Pubblicazione

1. Estrai lo ZIP.
2. Sostituisci completamente il contenuto della root del repository `casa`.
3. Carica anche la cartella `assets`.
4. Fai commit sul branch `main`.
5. Apri il sito con `?v=7` oppure premi `Ctrl+F5`.


## Novità v5
- Tutti i singoli mesh/oggetti visibili sono cliccabili.
- Nel pannello compare il codice oggetto completo da copiare e incollare in chat.


## Fix v6
- Corretta la scala dei 3 `attachment/countertop` (JID `b337125c-a2cb-4855-b1d0-2d56f790a847`).
- I countertop risultavano 10x troppo piccoli rispetto al progetto originale.


## Fix v7
- Corretta anche la scrivania/tavolo piccolo del primo piano (JID `2ca92782-818c-4812-81de-cdb2c2b6cba3`).
- Resa colori leggermente più neutra per evitare dominanti bluastre del viewer.
- Aggiunta lista completa oggetti con ricerca (`☰`) nel caso alcuni oggetti siano difficili da cliccare direttamente.


## Fix v8
- Rimosso il blocco `div#error` da `index.html`.
- Rimossi i relativi riferimenti JavaScript e CSS.
