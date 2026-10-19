# Condiciones de carrera: asignar un incidente

## Objetivo y alcance

TP2, tema 13 del grupo 8: dos solicitudes simultaneas intentan asignar el mismo
incidente a responsables diferentes. Reutilizamos el modelo de incidentes de
OpsBoard y comparamos una implementacion vulnerable con otra protegida.
La demo usa dos procesos de la API existente y una unica instancia de Redis.
No necesita publicar puertos ni acceder a la VM/cloud.

## Reproducir (PowerShell, Bash o terminal de VS Code)

Requisitos: Docker Desktop con motor Linux iniciado y Docker Compose v2.
Desde la raiz del repositorio, en esta rama:

```sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml up -d --build --wait
docker compose -f infrastructure/compose/docker-compose.race-demo.yml run --rm demo
```

El segundo comando lanza dos solicitudes en paralelo con `Promise.all`: Ana
contra `api-a` y Bruno contra `api-b`. Cada escenario crea un incidente nuevo;
se pueden repetir los comandos sin borrar datos de otros incidentes.
El script verifica que las respuestas provengan de procesos distintos y sale
con error si no observa los resultados esperados. Guarda el resultado de una
ejecucion exitosa en `docs/evidence/race-condition.json` (se sobrescribe al repetir).
La evidencia publicada corresponde a un ensayo, no garantiza cualquier carga.

| Escenario | Respuestas | Estado final |
| --- | --- | --- |
| Vulnerable | HTTP 200 + HTTP 200 | Un solo `assignedTo`, pero ambos clientes recibieron exito: la ultima escritura piso a la anterior. |
| Protegido | HTTP 200 + HTTP 409 | `assignedTo` coincide con el unico ganador. No importa quien gane. |

El script tambien comprueba rechazo de una asignacion posterior, HTTP 404 para
incidente inexistente y conservacion del responsable tras editar otro campo.

Ensayo local realizado el **18/10/2026 (America/Buenos_Aires)** con el compose
anterior: vulnerable **200 + 200**, responsable final Bruno; protegida
**200 + 409**, responsable final Ana. La evidencia JSON usa timestamps UTC
(19/10, equivalente a la noche del 18/10 en Argentina). Los nombres ganadores
dependen del orden de ejecucion, no son un resultado fijo esperado.
El workflow CI tambien ejecuta esta comparacion con contenedores y Redis reales.

Para detener solo este entorno aislado:

```sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml down
```

Diagnostico y respaldo para la exposicion:

```sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml ps
docker compose -f infrastructure/compose/docker-compose.race-demo.yml logs --tail 50 api-a api-b redis
```

Si Docker no arranca, resolver su arranque antes de la exposicion. El JSON de
evidencia permite comentar un ensayo previo, pero no sustituye probar la demo en
la maquina que se usara. No hace falta resetear Docker ni borrar sus volumenes.

## Por que ocurre la carrera

La version vulnerable hace tres pasos separados:

1. Lee el incidente y comprueba que no tiene responsable.
2. Espera 500 ms para hacer visible la ventana de carrera en la demostracion.
3. Escribe el responsable sin volver a comprobarlo.

Ana y Bruno pueden superar el paso 1 antes de que alguno llegue al paso 3.
Ambos creen haber obtenido el recurso, aunque Redis finalmente conserve un solo
valor. El bug es la doble confirmacion y la escritura perdida, no almacenar dos
nombres al mismo tiempo. La pausa solo facilita reproducir el intercalado; no es
una carga real medida ni una tecnica de sincronizacion.

La version protegida ejecuta un script Lua en Redis: comprueba existencia del
incidente, comprueba ausencia de `assignedTo` y escribe responsable/fecha dentro
de una unica operacion atomica. Ningun comando de otro cliente puede intercalarse
entre esas comprobaciones y la escritura. Devuelve conflicto si otro ya gano.
Un mutex en memoria de la API no bastaria: cada proceso tendria su propio mutex.

No alcanza con que cada `HGETALL` o `HSET` sea atomico: necesitamos proteger la
decision completa de comprobar y asignar. Esta garantia cubre las solicitudes
que usan el endpoint protegido, no escritores externos que ignoren el protocolo,
la variante vulnerable deliberada, ni escenarios de failover no ensayados.

## API y aislamiento

`POST /api/demo/incidents/:id/assign/vulnerable` y
`POST /api/demo/incidents/:id/assign/protected` reciben:

```json
{ "responsible": "Ana" }
```

Solo se registran con `RACE_DEMO_ENABLED=true`, configurado en el compose de demo.
Los stacks habituales y blue-green no habilitan esa variable. Mantener la ruta
vulnerable limitada al entorno educativo. No se modifica la interfaz web para
esta practica: la comparacion muestra las respuestas HTTP y el estado persistido.

## Guion breve para explicar y demostrar

1. Definir el recurso: un incidente, un unico responsable.
2. Anticipar el intercalado: ambos leen libre; ambos escriben y reciben exito.
3. Ejecutar la demo y comparar las dos respuestas con `final.assignedTo`.
4. Mostrar el script Lua de `apps/api/src/store/assignment.ts` y explicar donde
   empieza y termina la operacion atomica.
5. Mostrar el caso protegido: un exito, un conflicto y el responsable ganador.
6. Relacionarlo con [blue-green](blue-green.md): varias APIs pueden compartir el
   mismo estado; cambiar el trafico entre entornos no resuelve por si solo una
   carrera de datos.

Para comprobar comprension, cada expositor deberia poder explicar por que el
ultimo valor guardado no demuestra que haya habido un solo ganador, por que
Node.js puede tener esta carrera aun con un hilo JavaScript y por que un lock
local no coordina dos contenedores. Leer este guion no acredita ese aprendizaje.
