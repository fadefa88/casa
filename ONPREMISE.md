# Collegamento Home Assistant on-premise

Il dashboard funziona in modalità automatica:

- prova a collegarsi a Home Assistant;
- se URL o token non sono validi, mantiene i dati demo;
- quando Home Assistant è raggiungibile, legge stati e invia comandi ogni 5 secondi.

## 1. Configurare URL e token

Modificare `config.js`:

```js
homeAssistant: {
  url: 'http://192.168.4.xxx:8123',
  token: 'TOKEN_HOME_ASSISTANT'
}
```

Creare il token in Home Assistant da **Profilo → Token di accesso a lunga durata**.

## 2. Autorizzare l'origine del sito

Se il dashboard viene servito, ad esempio, da `http://casa3d.fritz.box`, aggiungere in `/config/configuration.yaml` di Home Assistant:

```yaml
http:
  cors_allowed_origins:
    - http://casa3d.fritz.box
    - http://192.168.4.xxx
```

Riavviare Home Assistant dopo la modifica.

## 3. Entity ID

`rooms-config.js` contiene:

- entità principali previste;
- nomi alternativi;
- ricerca automatica per nome stanza e dominio.

`config.js` contiene le entità globali per energia, rete, allarme, videocitofono e gruppi casa. Ogni valore può essere una stringa o un array di possibili `entity_id`.

## Funzioni già collegate

- lettura temperatura, umidità, luci, tapparelle e clima per stanza;
- accensione e spegnimento luci;
- apertura, stop e chiusura tapparelle;
- modifica setpoint clima a passi di 0,5 °C;
- accensione e spegnimento termostato;
- comandi globali luci e tapparelle;
- allarme casa/notte/disattivazione;
- pulsante cancello;
- dati energia, Shelly, FRITZ!Box e backup 5G;
- anteprima camera videocitofono quando disponibile.

Il token presente nel repository è volutamente un segnaposto e non consente accesso a Home Assistant.
