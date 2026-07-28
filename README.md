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


## Fix v9
- Corretto il pannello Lista oggetti: il pulsante × e il pulsante ☰ ora lo chiudono davvero.
- Dopo la selezione dalla lista, la lista si chiude automaticamente e resta visibile la scheda dell’oggetto.
- Aggiunta chiusura con tasto Esc.


## Fix v10
- Mensola decorativa `172324` con la stessa texture del mobile cucina `169003`.
- 8 sedie bianche in plastica (incluse le 6 attorno al tavolo della living room).
- Sedie `165836` e `165832` in plastica blu per gli slot `solid_002` e `solid_003`.
- Sedia `165822` in plastica azzurra per gli slot `solid_002` e `solid_003`.
- Divano `165791` slot `solid_002` con resa stoffa grigia.
- Mobile TV `165792` slot `solid_015` e `solid_016` bianchi uniformi.


## Fix v11
- Nascosto `first__LivingDiningRoom-116276__169003__cabinet_floor-based_kitchen_cabinet__solid_004`.
- `first__LivingDiningRoom-116276__169004__cabinet_wall-attached_cabinet__solid_003` reso tutto bianco.
- `first__LivingDiningRoom-116276__165791__sofa_type_L_sofa__solid_002` schiarito a grigio chiaro.


## Fix v12
- Aggiunte maniglie metalliche grigie a tutte le porte a battente.
- Aggiunto nottolino/chiusura metallica grigia alle porte scorrevoli.


## Fix v13
- Finitura maniglie e nottolini aggiornata a inox satinato.
- Le maniglie delle porte a battente restano presenti su entrambi i lati della porta.


## Fix v15 (base v13)
- Applicate solo modifiche materiali, visibilità e trasformazioni di oggetti richieste.
- Nessuna modifica alle geometrie di finestre, aperture o muri.
- Le maniglie procedurali sono state disattivate: le porte normali usano il proprio slot hardware in inox satinato; sulle scorrevoli lo slot hardware è nascosto.


## Fix v16
- Arredo esterno `179008` ridotto di un ulteriore 15% rispetto alla v15 (76,5% della dimensione originale).
- `169003__solid_003` e `169003__solid_006` ripristinati alla posizione precedente eliminando il riallineamento della v15.


## Fix v17
- `first__MasterBedroom-105249__156064__storage_unit_armoire__solid_001` abbassato in altezza del 5% mantenendo la base in appoggio.
