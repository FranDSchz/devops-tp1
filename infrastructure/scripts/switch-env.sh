#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTIVE_CONF="$SCRIPT_DIR/../nginx/active/env.conf"
COMPOSE_FILE="$SCRIPT_DIR/../compose/docker-compose.blue-green.yml"

usage() {
    echo "Usage: $0 <blue|green>"
    exit 1
}

[[ $# -ne 1 ]] && usage
ENV="$1"

case "$ENV" in
    blue|green) ;;
    *) echo "Error: entorno debe ser 'blue' o 'green'"; usage ;;
esac

SOURCE_CONF="$SCRIPT_DIR/../nginx/active/${ENV}.conf"

echo "Cambiando entorno activo a: $ENV"
cp "$SOURCE_CONF" "$ACTIVE_CONF"

echo "Recargando nginx..."
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload

echo "Listo. El trafico ahora apunta a: $ENV"
