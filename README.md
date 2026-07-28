# Casa Homestyler arredata e texturizzata

Pacchetto statico pronto per GitHub Pages o Cloudflare Pages.

## Pubblicazione

1. Estrai lo ZIP.
2. Sostituisci **tutto** il contenuto della root del repository `casa` con i file estratti.
3. Carica anche l’intera cartella `assets` senza rinominare nulla.
4. Fai commit sul branch `main`.
5. Dopo il deploy apri la pagina con `?v=2` oppure esegui `Ctrl+F5` per evitare la cache.

Non servono Node.js, npm o build.

## Funzionamento

- **Entrambi**: mostra i due piani sovrapposti nella posizione verticale corretta.
- **Primo piano**: nasconde il secondo.
- **Secondo piano**: nasconde il primo.
- Il modello usa gli arredi originali della scena Homestyler e le texture effettivamente presenti nel file HAR.
- I soffitti sono esclusi per permettere di vedere gli interni dall’alto.

## Limite tecnico

Il file HAR conteneva le texture richieste dal viewer in quella sessione. Alcuni piccoli oggetti non avevano una texture scaricata e usano quindi un materiale neutro; struttura, disposizione e arredi restano quelli originali.
