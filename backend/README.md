# Monitor IP pubblico e failover

Il monitor viene eseguito sul mini-PC, non nel browser. Ogni 45 secondi interroga più provider per rilevare l'IP pubblico, classifica il collegamento come `primary`, `backup` o `unknown`, registra l'inizio e la fine dei failover e pubblica lo stato tramite una piccola API locale.

## File prodotti

- `/var/lib/casa-network-monitor/network-status.json`: stato corrente.
- `/var/lib/casa-network-monitor/failover-events.jsonl`: storico append-only degli eventi.
- `/var/lib/casa-network-monitor/primary-ip.txt`: IP FTTH appreso automaticamente, quando non sono configurate reti esplicite.

## Installazione sul mini-PC

Assumendo che il repository sia in `/opt/casa`:

```bash
sudo cp /opt/casa/backend/network-monitor.env.example /etc/casa-network-monitor.env
sudo cp /opt/casa/backend/casa-network-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now casa-network-monitor
sudo systemctl status casa-network-monitor
```

Test locale:

```bash
curl http://127.0.0.1:8787/api/network-status
journalctl -u casa-network-monitor -f
```

## Classificazione FTTH / 5G

Il metodo più preciso è compilare in `/etc/casa-network-monitor.env` gli IP o le reti CIDR del collegamento principale e del backup:

```ini
PRIMARY_IP_NETWORKS=203.0.113.24/32
BACKUP_IP_NETWORKS=198.51.100.0/24
```

Quando queste reti non sono note, `AUTO_LEARN_PRIMARY=true` considera FTTH il primo IP rilevato. Un IP successivo differente viene considerato backup. Questo metodo è pratico, ma un normale cambio dell'IP dinamico FTTH può essere interpretato come failover; per eliminarne il rischio conviene usare reti CIDR o integrare in seguito anche lo stato WAN del FRITZ!Box.

Per reimparare l'IP FTTH:

```bash
sudo systemctl stop casa-network-monitor
sudo rm -f /var/lib/casa-network-monitor/primary-ip.txt
sudo systemctl start casa-network-monitor
```

## Pubblicazione sulla dashboard

Aggiungere al virtual host Nginx il contenuto di `nginx-network-monitor.conf.example`, poi ricaricare Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

La dashboard interroga quindi `/api/network-status` sullo stesso host. La richiesta esterna ai provider IP viene eseguita esclusivamente dal processo Python.
