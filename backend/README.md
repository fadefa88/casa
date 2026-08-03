# Monitor IP pubblico e failover

Il monitor viene eseguito sul mini-PC, non nel browser. Ogni 45 secondi rileva l'IP pubblico, ricava prefisso e ASN tramite RIPEstat, classifica il collegamento come `primary`, `backup` o `unknown`, registra inizio e fine dei failover e pubblica lo stato tramite una piccola API locale.

## Percorsi del mini-PC

- `/opt/casa-repo`: repository Git e codice sorgente, compreso il backend.
- `/var/www/casa`: copia statica pubblicata da Nginx per la dashboard.

Il servizio Python deve essere eseguito da `/opt/casa-repo/backend`. Non è necessario copiare il backend in `/var/www/casa`.

## File prodotti

- `/var/lib/casa-network-monitor/network-status.json`: stato corrente.
- `/var/lib/casa-network-monitor/failover-events.jsonl`: storico append-only degli eventi.
- `/var/lib/casa-network-monitor/primary-ip.txt`: IP primario appreso soltanto come fallback.

## Installazione sul mini-PC

```bash
cd /opt/casa-repo
git pull

sudo cp /opt/casa-repo/backend/network-monitor.env.example /etc/casa-network-monitor.env
sudo cp /opt/casa-repo/backend/casa-network-monitor.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now casa-network-monitor
sudo systemctl status casa-network-monitor
```

Dopo modifiche al backend:

```bash
cd /opt/casa-repo
git pull
sudo cp backend/casa-network-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart casa-network-monitor
```

Test locale:

```bash
curl http://127.0.0.1:8787/api/network-status
journalctl -u casa-network-monitor -f
```

## Classificazione Dimensione / WINDTRE

Configurazione consigliata in `/etc/casa-network-monitor.env`:

```ini
PRIMARY_ASNS=202870
BACKUP_ASNS=1267,24608
```

Il monitor interroga RIPEstat per associare l'IP pubblico al prefisso BGP e all'ASN di origine. Le regole CIDR restano disponibili e hanno precedenza sugli ASN:

```ini
PRIMARY_IP_NETWORKS=
BACKUP_IP_NETWORKS=
```

Questa combinazione evita di mantenere manualmente l'intero elenco dei pool. Se in futuro un IP viene annunciato da un ASN inatteso, lo stato JSON mostra `routed_prefix`, `origin_asns` e `classification_reason`, così si può aggiungere una regola precisa.

`AUTO_LEARN_PRIMARY=true` è soltanto un fallback quando né CIDR né ASN consentono la classificazione.

## Pubblicazione sulla dashboard

Aggiungere al virtual host Nginx il contenuto di `backend/nginx-network-monitor.conf.example`, quindi:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

La dashboard interroga `/api/network-status` sullo stesso host. Le richieste ai provider IP e a RIPEstat vengono eseguite esclusivamente dal processo Python.
