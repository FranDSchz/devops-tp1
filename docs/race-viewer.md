# Demo animada de la condicion de carrera

Desde la raiz del proyecto, con Docker Desktop (Linux) iniciado:

```sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml --profile viewer up -d --build --wait
```

Abrir **http://localhost:8092**. El puerto se publica solo en loopback. La pagina
no requiere Node instalado en la maquina ni conexion a cloud. Nginx sirve el HTML
y envia `/a/` a API A, `/b/` a API B. Ambas comparten Redis.

## Que mostrar (problema y comparacion opcional)

1. Explicar la regla: un incidente libre admite un unico responsable.
2. Mantener **Ver el problema** y pulsar **Ejecutar y animar peticiones reales**: crea un incidente y envia dos POST reales
   concurrentes a las APIs existentes. La pausa educativa de 500 ms en la version
   vulnerable facilita que ambas lean libre antes de escribir.
3. Mostrar las respuestas reales HTTP y el responsable final consultado con GET.
   Dos respuestas 200 y un solo responsable final evidencian doble confirmacion
   y una asignacion sobrescrita. No tiene que ganar una persona en particular.
4. La animacion representa usuarios, APIs, el incidente compartido, peticiones
   viajando y respuestas que vuelven. Muestra ambas comprobaciones libres antes
   de las escrituras y la sobrescritura. Es reconstruccion didactica despues de
   ejecutar; los paquetes no son captura de red ni medicion de latencia.
5. Activar **Avanzar manualmente** antes de ejecutar para narrar cada paso con
   **Siguiente paso**. Tambien hay reproduccion, pausa al terminar el paso,
   reinicio y control de ritmo. Reiniciar reproduce la misma evidencia; ejecutar
   crea otro incidente y envia peticiones nuevas.
6. Para el siguiente expositor, **Comparar con operacion atomica** envia ambas
   peticiones al endpoint protegido REAL. La animacion destaca comprobar/asignar
   como una unidad en Redis, seguida de conflicto para el otro solicitante.
   No representa un mutex adquirido por el usuario ni una lectura libre de ambos.

La pantalla no promete que siempre se reproduzca la carrera. Si no hay dos
lecturas libres y dos exitos, informa lo observado sin inventar un fallo.
Los timestamps de confirmacion de servidor tienen resolucion de 1 ms y no
garantizan orden global de escrituras. El diagrama presenta un orden de
escrituras compatible con las lecturas y con el GET final (ganador escrito al
final), no afirma reconstruir cada instante interno de Redis. La variante
protegida usa el orden logico exito/conflicto confirmado por los resultados Lua.

**Guardar evidencia JSON** descarga respuestas, trazas y estado final del ensayo.
Cada ejecucion usa un incidente nuevo; no resetea Redis ni otros incidentes.
Las rutas siguen restringidas a `RACE_DEMO_ENABLED=true`; los stacks habituales
no cambian. La traza opcional `?trace=true` agrega observaciones a la respuesta
del endpoint educativo; sin ese parametro conserva el contrato previo.

## Conexion con seguridad web (TOCTOU)

En este caso comprobamos que el recurso esta libre y despues usamos esa decision
para asignarlo. Otra solicitud puede modificarlo entre ambos pasos. Es el patron
time-of-check to time-of-use: una comprobacion valida no garantiza que el estado
siga siendo valido cuando actuamos. Un ejemplo web es canjear mas de una vez un
cupon de un solo uso. No toda race condition es TOCTOU ni todos los ataques
requieren solicitudes identicas. La prueba se hace exclusivamente en OpsBoard
local, con datos de demostracion.

Fuente conceptual: [PortSwigger Web Security Academy](https://portswigger.net/web-security/race-conditions).

Verificacion automatica (mismo gateway/servidores/Redis):

```sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml run --rm demo node verify-race-viewer.mjs
```

Para detener el entorno:

```sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml --profile viewer down
```

Para preparar el equipo de otro integrante: traer la rama/PR del visor y ejecutar
el primer comando con `--build`. La UI detecta una API vieja sin trazas e informa
el problema. [Demo vulnerable/protegida original](concurrency.md).
