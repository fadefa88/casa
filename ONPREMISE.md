# Collegamento Home Assistant on-premise

Il dashboard funziona in modalità automatica:

- prova a collegarsi a Home Assistant ogni 5 secondi;
- quando Home Assistant è raggiungibile, legge stati e invia comandi;
- quando URL, token o rete non funzionano, tutti i valori vengono mostrati come `NULL` e i comandi vengono disabilitati.

## 1. Creare il token in Home Assistant

In Home Assistant:

1. aprire il proprio profilo utente dal menu laterale in basso;
2. scorrere fino a **Token di accesso a lunga durata**;
3. premere **Crea token**;
4. assegnare un nome, per esempio `Dashboard Casa 3D`;
5. copiare subito il token generato, perché Home Assistant lo mostra una sola volta.

## 2. Inserire URL e token nel sito

Aprire il file `config.js` nella cartella principale del repository.

All'inizio del file è presente questo blocco:

```js
homeAssistant: {
  url: 'http://homeassistant.local:8123',
  token: 'REPLACE_WITH_HOME_ASSISTANT_LONG_LIVED_TOKEN'
}
```

Sostituirlo, per esempio, con:

```js
homeAssistant: {
  url: 'http://192.168.4.170:8123',
  token: 'INCOLLA_QUI_IL_TOKEN_REALE'
}
```

Usare l'indirizzo IP reale della VM Home Assistant. Non aggiungere `/` alla fine dell'URL.

## 3. Autorizzare l'origine del sito

Se il dashboard viene servito, per esempio, da `http://casa3d.fritz.box`, aggiungere in `/config/configuration.yaml` di Home Assistant:

```yaml
http:
  cors_allowed_origins:
    - http://casa3d.fritz.box
    - http://192.168.4.xxx
```

Sostituire `192.168.4.xxx` con l'indirizzo del server web on-premise e riavviare Home Assistant.

## 4. Verifica

Quando il collegamento funziona, il badge superiore mostra:

```text
HA live
```

Quando non funziona, mostra:

```text
HA OFFLINE · NULL
```

In stato offline i valori restano `NULL`: non vengono più mostrati dati demo.

## Entity ID

`rooms-config.js` contiene:

- entità principali previste;
- nomi alternativi;
- ricerca automatica per nome stanza e dominio.

`config.js` contiene le entità globali per energia, rete, allarme, videocitofono e gruppi casa. Ogni valore può essere una stringa o un array di possibili `entity_id`.

## Funzioni collegate

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

Il token attualmente presente nel repository è un segnaposto e non consente accesso a Home Assistant.
