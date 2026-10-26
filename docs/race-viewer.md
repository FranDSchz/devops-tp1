# Demo visual de la condicion de carrera

Desde la raiz del proyecto, con Docker Desktop (Linux) iniciado:

```sh
docker compose -f infrastructure/compose/docker-compose.race-demo.yml --profile viewer up -d --build --wait
```

Abrir **http://localhost:8092**. El puerto se publica solo en loopback. La pagina
no requiere Node instalado en la maquina ni conexion a cloud. Nginx sirve el HTML
y envia `/a/` a API A, `/b/` a API B. Ambas comparten Redis.

## Que mostrar (solo el problema)

1. Explicar la regla: un incidente libre admite un unico responsable.
2. Pulsar **Enviar Ana y Bruno a la vez**: crea un incidente y envia dos POST reales
   concurrentes a las APIs existentes. La pausa educativa de 500 ms en la version
   vulnerable facilita que ambas lean libre antes de escribir.
3. Mostrar las respuestas reales HTTP y el responsable final consultado con GET.
   Dos respuestas 200 y un solo responsable final evidencian doble confirmacion
   y una asignacion sobrescrita. No tiene que ganar una persona en particular.
4. Pulsar **Ver siguiente observacion** para recorrer las lecturas y confirmaciones
   de escritura registradas por los servidores. Es una reproduccion posterior de
   la traza real, no una pausa del servidor ni una animacion con datos inventados.
5. Opcional: **Ana termina antes de enviar Bruno** usa la misma ruta vulnerable
   pero solicita secuencialmente: 200/409. Muestra que el fallo depende del
   intercalado, no que todas las ejecuciones fallen ni que este boton implemente
   la solucion protegida. Esa explicacion corresponde al siguiente expositor.

La pantalla no promete que siempre se reproduzca la carrera. Si no hay dos
lecturas libres y dos exitos, informa lo observado sin inventar un fallo.
Timestamps de servidor con resolucion de 1 ms: empates no establecen orden global
de escrituras. Usar el GET final para saber quien quedo persistido.

**Guardar evidencia JSON** descarga respuestas, trazas y estado final del ensayo.
Cada ejecucion usa un incidente nuevo; no resetea Redis ni otros incidentes.
Las rutas siguen restringidas a `RACE_DEMO_ENABLED=true`; los stacks habituales
no cambian. La traza opcional `?trace=true` agrega observaciones a la respuesta
del endpoint educativo; sin ese parametro conserva el contrato previo.

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
