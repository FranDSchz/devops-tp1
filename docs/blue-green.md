# Blue-green deployment: cambio de tráfico y rollback

## Objetivo y alcance

TP2, tema despliegue. Pregunta guía: **¿Cómo publicar una
versión con cambio rápido y rollback de bajo riesgo?** El objetivo es **ejecutar
versiones azul y verde, alternar el proxy entre ellas y volver a la anterior**.

En OpsBoard, blue y green son dos conjuntos de contenedores: cada uno tiene
tres API y tres servidores web. Ambos usan el mismo Redis. Nginx recibe las
peticiones en `localhost:8081` y las envía al conjunto activo. El otro conjunto
permanece levantado para que el cambio de tráfico no dependa de iniciar
contenedores en ese momento.

Esta prueba es local. El Compose actual construye blue y green desde el mismo
código del repositorio: permite ensayar el cambio de tráfico y el rollback,
pero **no demuestra que se hayan publicado dos revisiones diferentes** de la
aplicación. Para publicar una versión nueva de verdad, el entorno inactivo
tendría que ejecutar esa nueva versión y pasar las comprobaciones antes de
recibir tráfico.

## Arquitectura y recorrido de una petición

~~~mermaid
flowchart LR
    cliente[Cliente] --> nginx[Nginx :8081]
    config[active/env.conf] -. selecciona el entorno .-> nginx
    nginx -->|si blue está activo| blue[blue: 3 web + 3 API]
    nginx -->|si green está activo| green[green: 3 web + 3 API]
    blue --> redis[(Redis compartido)]
    green --> redis
~~~

Solo una de las dos rutas que salen de Nginx está activa. El archivo
`infrastructure/nginx/active/env.conf` contiene el bloque de configuración
que el proxy carga en ese momento. Con blue activo, `/` y
`/instance.json` van a los servidores web blue; `/api/`, `/health` y
`/ready` van a las API blue. Al activar green, esas rutas pasan a los
servidores green. Redis no cambia.

Las tres réplicas de cada tipo reparten las peticiones dentro del entorno
elegido. Por eso dos consultas consecutivas pueden mostrar
`blue-api-1` y `blue-api-2` sin que haya ocurrido un switch: el dato
importante es el prefijo `blue` o `green`.

## Secuencia de la prueba

### 1. Levantar ambos entornos

Desde la raíz del repositorio, con Docker y Compose v2. Esta prueba usa el
puerto `8081` y un proyecto Compose propio; puede funcionar mientras el stack
habitual de OpsBoard sigue en `8080`. También tiene su propio volumen de Redis,
`redis-bg-data`. Para levantar ambos entornos:

~~~sh
docker compose -f infrastructure/compose/docker-compose.blue-green.yml up -d --build --wait
~~~

Al iniciar desde la configuración incluida en el repositorio, `env.conf`
apunta a blue.

Abrir `http://localhost:8081/demo/blue-green` en el navegador y dejar la
página visible. Es una ruta de la misma web de OpsBoard: consulta al proxy
cada 1,8 segundos y muestra qué instancias web y API responden, el estado de
Redis y los cambios de entorno detectados. El cambio se ejecuta con el script
en otra terminal; la página sirve para observarlo.

Antes de mover el tráfico, se puede comprobar que el destino green ya responde
desde su propio contenedor:

~~~sh
docker compose -f infrastructure/compose/docker-compose.blue-green.yml ps
docker compose -f infrastructure/compose/docker-compose.blue-green.yml exec -T green-api-1 wget -qO- http://127.0.0.1:3000/ready
~~~

`/ready` comprueba la conexión de esa API con Redis. La opción `--wait` espera
que los servicios con healthcheck estén saludables, pero el script de switch
no realiza esta verificación por sí mismo.

### 2. Comprobar el destino actual

~~~sh
curl -sS http://localhost:8081/health
curl -sS http://localhost:8081/instance.json
~~~

La primera respuesta incluye una instancia `blue-api-*` y la segunda,
`blue-web-*`. La URL pública es la misma durante toda la prueba; lo que
cambia es a qué contenedores apunta Nginx.

### 3. Pasar el tráfico a green

~~~sh
./infrastructure/scripts/switch-env.sh green
curl -sS http://localhost:8081/health
curl -sS http://localhost:8081/instance.json
~~~

El script copia `green.conf` sobre `active/env.conf` y pide a Nginx una
recarga de configuración. La recarga conserva el proceso del proxy: las
peticiones en curso pueden terminar con la configuración anterior y las
nuevas usan green. No reinicia Redis ni los contenedores blue o green.
Después del comando, `/health` debe mostrar `green-api-*` y
`/instance.json`, `green-web-*`.

Esta es la parte rápida del despliegue: el entorno de destino ya estaba
levantado y el cambio visible al cliente consiste en recargar el proxy.
El script no instala una imagen nueva ni decide automáticamente si green
está listo.

### 4. Volver a blue

Si green presenta un problema, el rollback de tráfico ejecuta el mismo
mecanismo en sentido inverso:

~~~sh
./infrastructure/scripts/switch-env.sh blue
curl -sS http://localhost:8081/health
curl -sS http://localhost:8081/instance.json
~~~

Las respuestas deben volver a `blue-api-*` y `blue-web-*`. Blue seguía
levantado, así que no hay que reconstruirlo para volver a atender peticiones.
El rollback cambia el destino del proxy; **no deshace datos escritos en
Redis** mientras green estuvo activo. Si una nueva versión modifica el
formato de esos datos, volver el tráfico a blue puede requerir una
estrategia adicional de compatibilidad.

### 5. Observar las respuestas durante el cambio

En una terminal se puede ejecutar la prueba continua:

~~~sh
./infrastructure/scripts/load-test.sh http://localhost:8081/health 30
~~~

Mientras corre, usar otra terminal para hacer el switch o el rollback. El
script cuenta respuestas `2xx`, `5xx` y otros resultados, incluidos errores
de conexión. Después de la operación, comparar el conteo con las respuestas
de `/health` y `/instance.json` para confirmar el destino final. La prueba
observa ese endpoint durante 30 segundos; no verifica todas las funciones
de la aplicación.

## Evidencia registrada

El documento original registró este ensayo local el **15/10/2026**:

| Operación | Peticiones a `/health` | `2xx` | `5xx` | Tiempo de rollback |
| --- | ---: | ---: | ---: | ---: |
| Blue → green | 131 | 131 | 0 | — |
| Green → blue | 129 | 129 | 0 | 597 ms |

En esas muestras no se observaron errores. Los **597 ms** corresponden al
rollback medido en aquel ensayo, desde el comando hasta Nginx recargado y
sirviendo blue. Son resultados de una prueba anterior, no una medición de
esta ejecución ni una garantía de cero interrupciones bajo cualquier carga.

## Archivos que intervienen

| Archivo | Función |
| --- | --- |
| `infrastructure/compose/docker-compose.blue-green.yml` | Levanta Redis, seis contenedores blue, seis green y Nginx. |
| `infrastructure/nginx/nginx.blue-green.conf` | Declara los upstreams blue y green e incluye `active/env.conf`. |
| `infrastructure/nginx/active/blue.conf` y `green.conf` | Dirigen las rutas web y API al entorno indicado. |
| `infrastructure/nginx/active/env.conf` | Configuración que Nginx carga como entorno activo. |
| `infrastructure/scripts/switch-env.sh` | Copia la configuración elegida y recarga Nginx. |
| `infrastructure/scripts/load-test.sh` | Cuenta respuestas durante el switch o el rollback. |
| `apps/web/src/BlueGreenDemo.tsx` | Muestra en la web el destino observado y los cambios detectados. |

El script de switch no hace una comprobación previa de green, ni un rollback
automático si falla la versión activada. Esas decisiones siguen siendo parte
del procedimiento de despliegue.

Para detener este entorno al terminar:

~~~sh
docker compose -f infrastructure/compose/docker-compose.blue-green.yml down
~~~

El volumen de Redis blue-green se conserva salvo que se use `down -v`.
