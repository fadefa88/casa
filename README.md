# Casa 5B — modello 3D reale

Pacchetto statico pronto per GitHub Pages.

## Pubblicazione

1. Estrai lo ZIP.
2. Apri il repository GitHub `casa`.
3. Sostituisci i file presenti nella root del repository con il contenuto estratto.
4. Mantieni esattamente la cartella `assets` e il file `assets/casa_web.glb`.
5. Esegui il commit sul branch `main`.

Non è necessario eseguire `npm install` e non esiste una fase di build.

## Controlli

- Trascinamento: rotazione
- Rotella o pinch: zoom
- Tasto destro o due dita: spostamento
- Affiancati: due piani sullo stesso livello
- Completa: piani nella posizione verticale reale
- Piano inferiore / superiore: visualizzazione separata
- Click su un elemento: identificazione del locale e del tipo architettonico

## File principali

- `index.html`: pagina principale
- `styles.css`: interfaccia responsive
- `app.js`: visualizzatore Three.js
- `assets/casa_web.glb`: modello reale recuperato da Homestyler
- `.nojekyll`: pubblicazione statica senza elaborazione Jekyll
