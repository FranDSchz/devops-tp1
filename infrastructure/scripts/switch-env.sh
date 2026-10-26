#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTIVE_CONF="$SCRIPT_DIR/../nginx/active/env.conf"
NGINX_CONTAINER="opsboard-bg-nginx"

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

if ! docker exec "$NGINX_CONTAINER" true >/dev/null 2>&1; then
    echo "Error: el proxy blue-green no está levantado ($NGINX_CONTAINER)" >&2
    exit 1
fi

PREVIOUS_CONF="$(mktemp)"
trap 'rm -f "$PREVIOUS_CONF"' EXIT
cp "$ACTIVE_CONF" "$PREVIOUS_CONF"

echo "Cambiando entorno activo a: $ENV"
cp "$SOURCE_CONF" "$ACTIVE_CONF"

echo "Recargando nginx..."
if ! docker exec "$NGINX_CONTAINER" nginx -t || ! docker exec "$NGINX_CONTAINER" nginx -s reload; then
    cp "$PREVIOUS_CONF" "$ACTIVE_CONF"
    echo "Error: no se pudo activar $ENV; se restauró la configuración anterior" >&2
    exit 1
fi

echo "Listo. El trafico ahora apunta a: $ENV"
