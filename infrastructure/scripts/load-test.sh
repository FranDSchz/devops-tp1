#!/usr/bin/env bash
# Dispara requests continuos contra el endpoint dado y reporta errores 5xx.
# Uso: ./load-test.sh [url] [duracion_segundos]
# Ejemplo: ./load-test.sh http://localhost:8080/health 30

set -euo pipefail

URL="${1:-http://localhost:8080/health}"
DURATION="${2:-30}"
INTERVAL=0.1   # segundos entre requests

total=0
ok=0
err5xx=0
other=0

end_time=$(( $(date +%s) + DURATION ))

echo "Iniciando load test: $URL durante ${DURATION}s (intervalo: ${INTERVAL}s)"
echo "Presiona Ctrl+C para detener antes."
echo ""

trap 'echo ""; echo "Interrumpido."; show_report' INT

show_report() {
    echo "-----------------------------------"
    echo "Resultados del load test"
    echo "-----------------------------------"
    echo "  Total requests : $total"
    echo "  2xx (ok)       : $ok"
    echo "  5xx (error)    : $err5xx"
    echo "  Otros          : $other"
    if [[ $total -gt 0 ]]; then
        pct=$(( err5xx * 100 / total ))
        echo "  Tasa de error  : ${pct}%"
    fi
    echo "-----------------------------------"
    exit 0
}

while [[ $(date +%s) -lt $end_time ]]; do
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$URL" 2>/dev/null || echo "000")
    total=$(( total + 1 ))
    case "$status" in
        2*) ok=$(( ok + 1 )) ;;
        5*) err5xx=$(( err5xx + 1 )); echo "  [$(date +%H:%M:%S)] 5xx: $status" ;;
        *)  other=$(( other + 1 )) ;;
    esac
    sleep "$INTERVAL"
done

show_report
