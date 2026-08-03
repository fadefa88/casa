#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/fadefa88/casa.git"
BRANCH="main"
WEBROOT="/var/www/casa"
ENV_FILE="/etc/casa3d.env"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Esegui questo script come root." >&2
  exit 1
fi

for command in git rsync python3 nginx; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Manca il comando: $command" >&2
    echo "Installa i prerequisiti con: apt update && apt install -y git rsync python3 nginx" >&2
    exit 1
  fi
done

HA_URL="http://homeassistant.local:8123"
HA_TOKEN="REPLACE_WITH_HOME_ASSISTANT_LONG_LIVED_TOKEN"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Scarico l'ultima versione da GitHub..."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP_DIR/repo"

mkdir -p "$WEBROOT"
rsync -a --delete \
  --exclude='.git/' \
  --exclude='deploy-onprem.sh' \
  "$TMP_DIR/repo/" "$WEBROOT/"

export HA_URL HA_TOKEN WEBROOT
python3 <<'PY'
import os
import re
from pathlib import Path

webroot = Path(os.environ['WEBROOT'])
config_path = webroot / 'config.js'
text = config_path.read_text(encoding='utf-8')

def js_single(value: str) -> str:
    return value.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '')

url = js_single(os.environ.get('HA_URL', 'http://homeassistant.local:8123'))
token = js_single(os.environ.get('HA_TOKEN', 'REPLACE_WITH_HOME_ASSISTANT_LONG_LIVED_TOKEN'))

pattern = re.compile(
    r"(homeAssistant\s*:\s*\{\s*url\s*:\s*)'[^']*'(\s*,\s*token\s*:\s*)'[^']*'",
    re.DOTALL,
)
replacement = lambda match: f"{match.group(1)}'{url}'{match.group(2)}'{token}'"
new_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('Blocco homeAssistant non trovato in config.js')

config_path.write_text(new_text, encoding='utf-8')
PY

chown -R www-data:www-data "$WEBROOT"
find "$WEBROOT" -type d -exec chmod 755 {} +
find "$WEBROOT" -type f -exec chmod 644 {} +

nginx -t
systemctl reload nginx

echo
echo "Aggiornamento completato: http://casa3d.fritz.box/"
if [[ "$HA_TOKEN" == "REPLACE_WITH_HOME_ASSISTANT_LONG_LIVED_TOKEN" || -z "$HA_TOKEN" ]]; then
  echo "Home Assistant non è ancora configurato: il dashboard mostrerà NULL."
  echo "Modifica $ENV_FILE e rilancia: update-casa"
else
  echo "Configurazione Home Assistant applicata da $ENV_FILE."
fi
