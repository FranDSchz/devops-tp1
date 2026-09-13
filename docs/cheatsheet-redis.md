## Redis

> **En OpsBoard, Redis corre dentro de un contenedor de Docker** (servicio `redis` del `docker compose`), por lo que no hace falta instalarlo en la maquina local. Las siguientes secciones de instalacion son referencia general para usar Redis fuera del proyecto.

### Instalarlo con Docker (referencia general)
```
docker run -d --name redis -p 6379:6379 redis:7-alpine
```
- Si no tenes instalado redis-cli
```
docker exec -it redis redis-cli
```
- Si tenes redis-cli
```
redis-cli -h 127.0.0.1 -p 6379
```

### Activarlo
```
redis-server
```
- Hay que dejarlo activo

### Ingresar al servidor
``` 
redis-cli 
```
- Para salir
```
quit
```

### Agregar y obtener valores claves:valor
- Agregar
```
set name kyle
```
- Obtener
```
get name
```
- Eliminar
```
del name
```
- Saber si existe (devuelve 1 si es verdadero y 0 si es falso)
```
exists name
```
- Obtenemos todos los valores claves
```
keys *
```
- Eliminamos todos los valores
```
flushall
```

### TTL (time to live)
- Agregarle un tiempo de expiracion 
```
expire name 10 
```
- Ver cuanto tiempo le queda
```
ttl name
```
- Si es negativo ya no existe, si es constantemente -1 es porque no expira nunca
- Para crear valores con tiempo de expiracion
```
setex name 10 kyle
```

### Crear arrays
```
lpush friends celeste
```
- Obtener los valores
```
lrange friends 0 -1
```
- Agregar un valor en la izquierda (al inicio)
```
lpush friends lauti
```
- Agregar un valor en la derecha (al final)
```
rpush friends franco
```
- Eliminar un elemento al inicio
```
pop friends
```
- Eliminar un elemento al final
```
rpop friends
```

### Sets
```
sadd hobbies "futbol"
```
- Ver todos los elementos dentro de un set
```
smembers hobbies
```
- Eliminar un elemento
```
srem hobbies "futbol"
```
- Para agregar
```
sadd hobbies "voley"
```

### Hashes
```
hset person name kyle
```
- Get the value of an object with the key
```
hget person name
```
- Get all keys and values
```
hgetall person
```
- Eliminar una clave
```
hdel person name
```
- Chequear si existe una key
```
hexists person name
```

---

## OpsBoard - Inspeccion de datos (M2)

Los incidentes se almacenan en Redis como **hashes**, con un **set indice** global que guarda las claves de todos los incidentes.

### Ingresar al contenedor de Redis
```
docker exec -it opsboard-redis redis-cli
```

### Listar todos los IDs de incidentes
```
SMEMBERS incidents
```
Devuelve claves del tipo `incident:<uuid>`.

### Ver un incidente completo (hash)
```
HGETALL incident:<uuid>
```

### Ver un campo puntual
```
HGET incident:<uuid> title
```
Campos disponibles: `id`, `title`, `service`, `severity`, `status`, `createdAt`, `updatedAt`.

### Ver TODAS las claves
```
KEYS incident:*
```

### Cantidad de incidentes
```
SCARD incidents
```

### Eliminar un incidente a mano
```
DEL incident:<uuid>
SREM incidents incident:<uuid>
```

### Limpiar toda la base
```
FLUSHALL
```
