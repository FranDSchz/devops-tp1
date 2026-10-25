# Condiciones de carrera: asignar un incidente

## Objetivo y alcance

TP2, tema 13 del grupo 8: dos solicitudes simultaneas intentan asignar el mismo
incidente a responsables diferentes. Reutilizamos el modelo de incidentes de
OpsBoard y comparamos una implementacion vulnerable con otra protegida.
La demo usa dos procesos de la API existente y una unica instancia de Redis.
No necesita publicar puertos ni acceder a la VM/cloud.

Para replicar la experiencia: Las rutas de asignación se registran únicamente cuando `RACE_DEMO_ENABLED=true`, como en el Compose de esta prueba. En el stack habitual de OpsBoard no están disponibles: una petición a `/api/demo/incidents/:id/assign/...` devuelve `404`.

Requisitos: Docker Desktop con motor Linux iniciado y Docker Compose v2. 

## Secuencia de la prueba

El script `infrastructure/scripts/race-demo.mjs` compara las rutas de asignación
vulnerable y protegida. Para cada versión crea un incidente, envía dos
asignaciones simultáneas de responsable al mismo incidente y consulta el estado persistido en la base de datos. Cada versión usa un incidente distinto.

Para ejecutar la experiencia, correr desde la raíz del repositorio:

~~~sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml up -d --build --wait
docker compose -f infrastructure/compose/docker-compose.race-demo.yml run --rm demo
~~~

### Ejecución vulnerable
A continuación se muestra un ejemplo del intercambio HTTP de la versión vulnerable: 

~~~http
POST /api/incidents HTTP/1.1
Host: api-a:3000
Content-Type: application/json

{"title":"Race demo vulnerable","service":"demo","severity":"low"}
~~~

La respuesta es `201 Created` con el ID
`6cf97d46-5232-4063-94b6-fd940c00a433`. El script usa ese mismo ID en las
dos solicitudes siguientes, lanzadas con `Promise.all`:

~~~http
POST /api/demo/incidents/6cf97d46-5232-4063-94b6-fd940c00a433/assign/vulnerable HTTP/1.1
Host: api-a:3000
Content-Type: application/json

{"responsible":"Ana"}
~~~

~~~http
POST /api/demo/incidents/6cf97d46-5232-4063-94b6-fd940c00a433/assign/vulnerable HTTP/1.1
Host: api-b:3000
Content-Type: application/json

{"responsible":"Bruno"}
~~~

Ambas requests tienen response `200 OK` y 
`"result":"assigned"`. La consulta posterior
`GET /api/incidents/6cf97d46-5232-4063-94b6-fd940c00a433` devolvió
`"assignedTo":"Bruno"`: la escritura de Bruno reemplazó la de Ana, pese a que
ambas asignaciones habían recibido confirmación.

## Dos procesos sobre un Redis

El Compose de la prueba ejecuta dos instancias del servidor existente
`apps/api`, llamadas `api-a` y `api-b`, conectadas a un mismo Redis. El script
envía una asignación directamente a cada instancia, sin depender de cómo
distribuiría las solicitudes un balanceador.

Cada respuesta incluye el encabezado `X-Instance-ID`. El script comprueba que
los dos valores sean distintos; si no lo son, falla con:

~~~text
AssertionError: Use two distinct API processes
~~~

Esa comprobación asegura que el ensayo cubra concurrencia entre procesos.
El mismo intercalado de lecturas y escrituras también puede ocurrir con dos
solicitudes atendidas por una sola instancia de Node.js.

## Qué falla y cómo solucionarlo

La ruta vulnerable lee los campos guardados para un incidente, comprueba que `assignedTo` esté vacío,
espera 500 ms y guarda el nuevo responsable. Las dos solicitudes pueden completar la
comprobación antes de la primera escritura. 

La diferencia es cuándo vuelve a comprobarse si el incidente está libre.
En la ruta vulnerable puede pasar esto:

Ana lee: assignedTo vacío
Bruno lee: assignedTo vacío
Ana escribe: assignedTo = Ana    → 200
Bruno escribe: assignedTo = Bruno → 200

Bruno escribe después, pero su decisión se basó en una lectura anterior. Por eso los dos reciben éxito.
En la ruta protegida, Redis ejecuta la comprobación y la escritura juntas, sin intercalar la otra solicitud:

Ana: comprueba vacío → escribe Ana → termina → 200
Bruno: comprueba ocupado → no escribe → 409

409 Conflict significa “este incidente ya fue asignado”. No tiene que ganar Ana: si Bruno llega primero, Bruno recibe 200 y Ana recibe 409

La ruta protegida ejecuta en Redis un script Lua que comprueba la existencia
del incidente, comprueba `assignedTo` y escribe el responsable con una sola
operación. La segunda asignación encuentra el campo ocupado y recibe `409`.

El segundo comando valida los códigos, la identidad de las instancias y el
valor final de `assignedTo`. También comprueba un segundo intento de asignación
(`409`), un incidente inexistente (`404`) y una edición posterior que conserva
el responsable. Una aserción fallida termina la ejecución con error. Si todas
pasan, se escribe `docs/evidence/race-condition.json`; una nueva ejecución
sobrescribe ese archivo. El JSON del repositorio refleja una ejecución concreta.

### Ejecución protegida
El script repite la secuencia con un incidente nuevo y la ruta
`/assign/protected`. El resultado esperado es `200` para una solicitud y `409`
para la otra, y `assignedTo` debe coincidir con la que recibió `200`. El orden de
llegada determina quién gana. 



| Ruta | Respuestas esperadas | Estado final |
| --- | --- | --- |
| Vulnerable | `200 + 200` | Un valor en `assignedTo`; una confirmación quedó invalidada por la última escritura. |
| Protegida | `200 + 409` | `assignedTo` coincide con la única asignación confirmada. |



Para detener el entorno:

~~~sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml down
~~~

Para inspeccionar los contenedores si falla:

~~~sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml ps
docker compose -f infrastructure/compose/docker-compose.race-demo.yml logs --tail 50 api-a api-b redis
~~~


