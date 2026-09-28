# Cheatsheet de Redis — OpsBoard

> Redis corre dentro de un contenedor de Docker (servicio `redis` del compose), no en la maquina local. Por eso no hay nada que instalar: se opera con `docker exec`.

```bash
# Local
docker exec -it opsboard-redis redis-cli

# Cloud
docker exec -it opsboard-cloud-redis redis-cli

# Ver el log del contenedor
docker logs opsboard-redis
```

---

## Incidentes

Los incidentes se almacenan como **hashes**, con un **set indice** global que guarda las claves de todos los incidentes.

| Operacion | Comando |
| --- | --- |
| Listar IDs | `SMEMBERS incidents` |
| Ver un incidente | `HGETALL incident:<uuid>` |
| Ver un campo | `HGET incident:<uuid> title` |
| Cantidad | `SCARD incidents` |
| Eliminar a mano | `DEL incident:<uuid>` + `SREM incidents incident:<uuid>` |
| Limpiar todo | `FLUSHALL` (borra tambien el registro de flota) |

Campos de cada incidente: `id`, `title`, `service`, `severity`, `status`, `createdAt`, `updatedAt`.

> `KEYS *` esta bloqueante en Redis y no se usa en produccion. El listado de incidentes se resuelve con `SMEMBERS` sobre el set indice, en complejidad O(N) predecible.

---

## Flota de replicas

Cada replica de la API escribe un latido cada 5 segundos. El TTL es **logico**, no un `EXPIRE` de Redis: se apoya en el score del ZSET.

| Estructura | Contenido |
| --- | --- |
| ZSET `fleet:api` | member = id de instancia, score = timestamp del ultimo latido |
| HASH `fleet:api:data` | campo = id de instancia, valor = JSON con metricas del proceso |

| Operacion | Comando |
| --- | --- |
| Ver la flota con sus latidos | `ZRANGE fleet:api 0 -1 WITHSCORES` |
| Solo las vivas (TTL 15 s) | `ZRANGEBYSCORE fleet:api <epoch-actual-15000> +inf` |
| Ver las caidas | `ZRANGEBYSCORE fleet:api -inf <epoch-actual-15000>` |
| Metricas de una replica | `HGET fleet:api:data api-1` |
| Ver todas las metricas | `HGETALL fleet:api:data` |
| Cuantas replicas hay | `ZCARD fleet:api` |

El JSON de cada replica incluye `id`, `role`, `startedAt`, `memoryRss`, `heapUsed`, `node`, `nodeVersion` y `pid`.

Una replica que se detiene deja de refrescar su score, deja de aparecer en `ZRANGEBYSCORE` y **el endpoint que la consume la purga** (`ZREM` + `HDEL`) al detectarla. Se puede reproducir:

```bash
docker stop opsboard-api-2
sleep 16
curl -s http://localhost:8080/api/instances | jq '.instances[].id'   # ya no aparece api-2
docker start opsboard-api-2
```

---

## Diagnostico general

```bash
PING                 # PONG
INFO memory          # uso de memoria del servidor
DBSIZE               # cantidad total de claves
INFO keyspace        # distribucion por base
CONFIG GET appendonly  # durability (appendonly yes)
```
