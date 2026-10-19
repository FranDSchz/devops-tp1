# Guion de presentación TP2

Demo en vivo para los dos temas obligatorios: blue-green deployment y condiciones de carrera.

**Tiempo estimado:** 15–20 minutos  
**Requisito previo:** Docker Desktop corriendo en la máquina de demo.

---

## Antes de arrancar (preparación)

```bash
# Verificar que Docker está corriendo
docker info

# Opcional: limpiar contenedores anteriores para empezar limpio
docker compose -f infrastructure/compose/docker-compose.blue-green.yml down 2>/dev/null
docker compose -f infrastructure/compose/docker-compose.race-demo.yml down 2>/dev/null
```

---

## Tema 1 — Blue-Green Deployment

### Contexto a explicar (30 seg)

> "Tenemos dos entornos idénticos corriendo en paralelo: blue y green. Nginx apunta a uno solo. Vamos a deployar una nueva versión al entorno inactivo, cambiar el proxy sin cortar el servicio, y hacer rollback en menos de un segundo."

### Demo paso a paso

```bash
# 1. Levantar el stack completo (blue + green + nginx + redis)
docker compose -f infrastructure/compose/docker-compose.blue-green.yml up -d

# 2. Mostrar que blue está activo y respondiendo
curl -s http://localhost:8080/health

# 3. Arrancar prueba de carga en segundo plano (muestra que no hay errores durante el switch)
./infrastructure/scripts/load-test.sh http://localhost:8080/health 30 &

# 4. Ejecutar el switch a green (deploy de nueva versión)
./infrastructure/scripts/switch-env.sh green

# 5. Verificar que green está sirviendo
curl -s http://localhost:8080/health

# 6. Ejecutar el rollback a blue
time ./infrastructure/scripts/switch-env.sh blue

# 7. Verificar que blue volvió a ser el activo
curl -s http://localhost:8080/health
```

### Qué mostrar en pantalla

- La salida del `load-test.sh` al terminar: **0 errores 5xx** durante el switch y el rollback.
- El tiempo del `time`: **< 600ms** de rollback.
- El `health` antes y después de cada switch para que se vea el cambio de instancia.

### Puntos clave a mencionar

- El switch es un `nginx -s reload` — Nginx termina las conexiones activas antes de cambiar.
- Redis **no se reinicia**: ambos entornos comparten el mismo estado, no hay pérdida de datos.
- Rollback = exactamente el mismo comando en dirección inversa.

---

## Tema 2 — Condiciones de Carrera y Control de Concurrencia

### Contexto a explicar (30 seg)

> "Un incidente tiene un único responsable. Vamos a lanzar dos solicitudes simultáneas de asignación contra el mismo incidente. Primero con la versión vulnerable: las dos creen ganar. Después con la versión protegida con Lua: solo una gana."

### Demo paso a paso

```bash
# 1. Levantar el entorno de demo de concurrencia
docker compose -f infrastructure/compose/docker-compose.race-demo.yml up -d --build --wait

# 2. Ejecutar la demo (lanza Ana y Bruno en paralelo)
docker compose -f infrastructure/compose/docker-compose.race-demo.yml run --rm demo
```

### Qué mostrar en pantalla

La salida del script muestra los dos escenarios en secuencia:

| Escenario | Respuestas HTTP | Estado final |
|---|---|---|
| Vulnerable | 200 + 200 | Un solo `assignedTo`, pero **ambos** clientes recibieron éxito — escritura perdida |
| Protegido | 200 + 409 | Solo el ganador queda en `assignedTo` — el otro recibe conflicto |

Mostrar también `docs/evidence/race-condition.json` como evidencia del ensayo previo.

### Puntos clave a mencionar

- Node.js tiene un solo hilo JS, pero la carrera ocurre igual porque hay **dos procesos** (dos contenedores API) accediendo al mismo Redis.
- Un lock local (en memoria de un proceso) no sirve: cada API tiene su propio espacio de memoria.
- La solución: un **script Lua en Redis** que hace leer + verificar + escribir como una sola operación atómica. Mostrar `apps/api/src/store/assignment.ts`.
- Relación con blue-green: cambiar el tráfico entre entornos no resuelve una carrera de datos — el problema está en la lógica de escritura compartida.

```bash
# Detener el entorno de demo al terminar
docker compose -f infrastructure/compose/docker-compose.race-demo.yml down
```

---

## Plan B si algo falla

### Docker no arranca

No limpiar ni reinstalar en vivo. Mostrar la evidencia JSON pre-grabada:

```bash
cat docs/evidence/race-condition.json
cat docs/evidence/blue-green-rollback.json
```

Comentar los resultados desde los archivos y explicar el mecanismo en la pizarra.

### El switch de Nginx no cambia el upstream

```bash
# Verificar el contenedor nginx
docker compose -f infrastructure/compose/docker-compose.blue-green.yml ps nginx

# Ver el env.conf actual
cat infrastructure/nginx/active/env.conf

# Forzar recarga manual
docker compose -f infrastructure/compose/docker-compose.blue-green.yml exec nginx nginx -s reload
```

### El script de demo de concurrencia falla

```bash
# Ver logs de las APIs
docker compose -f infrastructure/compose/docker-compose.race-demo.yml logs --tail 50 api-a api-b redis

# Verificar que los contenedores están corriendo
docker compose -f infrastructure/compose/docker-compose.race-demo.yml ps
```

---

## Preguntas frecuentes del profe

- **"¿Por qué no simplemente reiniciar el servidor para deployar?"** → El downtime es inaceptable en producción; blue-green garantiza cero interrupción.
- **"¿Qué pasa si Redis cae durante el switch?"** → Los dos entornos dejan de funcionar; Redis es un punto único de fallo. Alta disponibilidad de Redis (Sentinel/Cluster) sería el siguiente paso.
- **"¿Por qué Lua y no un `WATCH`/`MULTI`?"** → Lua es más simple y más eficiente: no requiere retry en el cliente. `WATCH` necesita que el cliente reintente si detecta una modificación concurrente.
- **"¿Por qué el vulnerable da 200+200 si Redis guarda un solo valor?"** → Porque ambos procesos leyeron "libre" antes de que alguno escribiera. La escritura perdida es el bug: un cliente creyó ganar y no ganó.
