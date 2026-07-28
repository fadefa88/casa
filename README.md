# Casa 5B — Homestyler fedele

Pacchetto statico pronto per GitHub Pages. Contiene un unico modello GLB con geometrie, arredi e texture incorporate.

## Pubblicazione

1. Estrai lo ZIP.
2. Sostituisci completamente il contenuto della root del repository `casa`.
3. Carica anche la cartella `assets`.
4. Esegui il commit sul branch `main`.
5. Apri il sito con `?v=5` o premi `Ctrl+F5`.

Non servono Node.js, npm o build.

## Viste

- **Entrambi**: i due livelli restano uno sopra l'altro nella posizione originale.
- **Primo piano**: nasconde il secondo piano.
- **Secondo piano**: nasconde il primo piano.

## Fedeltà materiali

Il GLB incorpora le texture registrate dal viewer e ricostruisce 250 materiali V-Ray originali, oltre alle personalizzazioni applicate alle singole istanze. I materiali V-Ray sono convertiti in PBR/glTF; riflessi e illuminazione possono differire leggermente dal motore Homestyler, mentre colori di base e texture derivano dai dati originali della scena.

Oggetti: 79 istanze di arredo. Mesh arredo: 446. Mesh architettura: 176.
