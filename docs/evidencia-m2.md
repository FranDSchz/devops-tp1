# Evidencia M2 — final (rama `nginx-reverse-proxy`)

Stack dejado levantado. Runtime: Podman + `podman compose`. Sin commit ni push. Solo se tocó este archivo.

## 1. Rama, estado, diff, comentarios — PASS con 1 pero

```sh
git branch --show-current; git status --short; git diff --stat
Select-String -Path apps/api/src/index.ts,apps/web/src/App.tsx -Pattern '^\s*//'
Select-String -Path infrastructure/nginx/nginx.conf,apps/api/Dockerfile,apps/web/Dockerfile -Pattern '^\s*#' | Where-Object { $_ -notmatch 'http://' }
```

```text
nginx-reverse-proxy
M apps/api/Dockerfile
M apps/api/src/index.ts
M apps/web/Dockerfile
M apps/web/src/App.test.tsx
M apps/web/src/App.tsx
M infrastructure/compose/docker-compose.yml
M infrastructure/nginx/nginx.conf
?? apps/api/src/ready.test.ts
?? docs/evidencia-m2.md
7 files changed, 99 insertions(+), 30 deletions(-)
index.ts + App.tsx: sin matches // → PASS
nginx.conf + api/Dockerfile: sin matches # → PASS
apps/web/Dockerfile: 2 matches (# ---- Build stage ----, # ---- Runtime stage...) → FAIL estricto (preexistentes, no tocados acá)
```

## 2. Contenedores + nginx — PASS

```sh
podman ps --format "{{.Names}} {{.Status}}"
podman exec opsboard-nginx nginx -T
```

```text
opsboard-redis Up (healthy) | opsboard-api-1 Up (healthy) | opsboard-api-2 Up (healthy)
opsboard-api-3 Up (healthy) | opsboard-nginx Up 0.0.0.0:8080->80/tcp
opsboard-web-1 Up | opsboard-web-2 Up | opsboard-web-3 Up  → 8/8 Up
nginx: configuration file /etc/nginx/nginx.conf test is successful
upstream api: api-1/2/3 (max_fails=1 fail_timeout=10s); locations /api/ /health /ready → api_upstream, / → web_upstream
```

## 3. Rotación — PASS

```sh
for ($i=1; $i -le 6; $i++) { curl.exe -s -D - http://localhost:8080/health -o NUL | Select-String "instance-id" }   # igual /ready, /api/incidents
for ($i=1; $i -le 3; $i++) { curl.exe -s http://localhost:8080/health }
for ($i=1; $i -le 3; $i++) { curl.exe -s http://localhost:8080/instance.json }
curl.exe -s -i http://localhost:8080/api/incidents | Select-String "HTTP/|instance-id"
curl.exe -s -i http://localhost:8080/ | Select-String "HTTP/"
```

```text
/health X-Instance-ID: api-1, api-2, api-3, api-1, api-2, api-3
/ready   X-Instance-ID: api-1, api-2, api-3, api-1, api-2, api-3
cuerpos: {"status":"ok","instance":"api-1/2/3"} en ciclo
/api/incidents: HTTP/1.1 200 OK + x-instance-id rotando (lista JSON con 2 incidentes)
/instance.json cuerpos: {"instance":"web-1"}{"instance":"web-2"}{"instance":"web-3"}
/ : HTTP/1.1 200 OK (sin X-Instance-ID: estático vía web_upstream, instancia vía /instance.json)
```

## 4. Tolerancia — PASS (todo levantado al final)

```sh
podman stop opsboard-api-2
for ($i=1; $i -le 12; $i++) { curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/health }
podman start opsboard-api-2; Start-Sleep 8; podman exec opsboard-nginx nginx -s reload
# luego 4x /health /ready /api/incidents; podman stop opsboard-web-2 → curl / ; podman start opsboard-web-2 + reload
```

```text
api-2 parado: 12/12 200, cero 502 (solo api-1/api-3)
recuperado + reload: /health cuerpos api-1/2/3 en ciclo; /ready api-2,3,1,2; /api/incidents api-3,1,2,3 → 4/4/4
web-2 parado: / → 200; /instance.json → web-3, web-3, web-1 (solo vivas)
recuperado + reload: / → 200; final: 8/8 Up
Nota: tras `start` hizo falta `nginx -s reload` (IP nueva del contenedor); cuerpos confirman ciclo completo.
```

## 5. Badge Web/API — PASS

```sh
curl.exe -s -o NUL -w "%{http_code}\n" http://localhost:8080/
curl.exe -s http://localhost:8080/assets/index-*.js | Select-String "/health|Web"
curl.exe -s -o NUL -w "%{http_code}\n" http://localhost:8080/health
```

```text
/ → 200 (shell <!DOCTYPE html> + /assets/index-BxNXUn1W.js)
/health → 200
JS (197882 chars): `Web ${W} · API ${cl}` + fetch("/instance.json") + fetch("/health") + fetch(`${Qn}/incidents`)
("Web" vive en el bundle renderizado, no en el HTML shell.)
```

## 6. Tests + typecheck — PASS salvo falla preexistente conocida

```sh
npm run test -w apps/api -- src/ready.test.ts
npm run test -w apps/web
npm run test -w apps/api
npm run typecheck -w apps/api; npm run typecheck -w apps/web
```

```text
ready.test.ts: 2 passed
web App.test.tsx: 5 passed
api full: 8 passed, 1 failed → incidents.test.ts:165 `expect(updated?.updatedAt).not.toBe(created.updatedAt)`:
  expected '2026-09-09T16:54:03.695Z' not to be mismo ms → FALLA PREEXISTENTE, sigue igual
typecheck api: ok (tsc --noEmit sin errores); typecheck web: ok
```

## Veredicto

1. PASS c/ pero (2 `#` preexistentes en apps/web/Dockerfile) · 2. PASS · 3. PASS · 4. PASS · 5. PASS · 6. PASS salvo `incidents.test.ts:165` preexistente.
