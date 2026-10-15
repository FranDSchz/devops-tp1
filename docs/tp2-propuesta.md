# Propuesta de organizacion - TP2

Organizacion del TP2 en Issues de GitHub. No reemplaza al roadmap de TP1 ([docs/roadmap.md](roadmap.md)); lo extiende con los temas nuevos a presentar.

**Estado:** aprobado por el equipo. El milestone `M5` y los Issues de este documento se crean en GitHub siguiendo este desglose.

> **Nota del profesor:** automatizar el despliegue a Cloud ya no es un requisito del TP2. El **Tema 3 (Continuous Delivery)** pasa a ser **opcional** (un plus si el equipo tiene tiempo), no bloquea la entrega ni la presentacion.

## Consigna

> 1. Despliegue: blue-green deployment. Como publicar una version con cambio rapido y rollback de bajo riesgo? Ejecutar versiones azul y green, alternar el proxy entre ellas y volver a la anterior.
> 2. Consistencia: condiciones de carrera y controles de concurrencia. Como impedir que dos procesos asignen el mismo recurso? Lanzar dos solicitudes simultaneas sobre un unico cupo y comparar una version vulnerable con otra protegida.

## Milestone propuesto

**M5 - TP2: Blue-Green y Concurrencia**

Descripcion sugerida: Despliegue blue-green con rollback de bajo riesgo y control de condiciones de carrera en la asignacion de un recurso con cupo unico.

## Decisiones confirmadas

- **Se trabaja sobre el proyecto existente (OpsBoard)**, no se arma una app o servicio nuevo para la demo.
- **Tema 1 (blue-green)**: se reutiliza el stack completo de OpsBoard (web + api + Redis) de [infrastructure/compose](../infrastructure/compose). Blue y green son dos instancias de ese mismo stack compartiendo Redis, no un servicio simplificado aparte.
- **Tema 2 (concurrencia)**: el recurso con cupo unico es el modelo de incidentes que ya existe. El caso concreto propuesto es **asignar un incidente a un unico responsable** (agregar un campo tipo `assignedTo` al incidente existente): dos solicitudes simultaneas intentan tomar el mismo incidente y solo una debe ganarlo. No se modela un dominio nuevo.

## Resumen de tareas

| # | Tema | Tarea | Que se hace (breve) | Prioridad |
| --- | --- | --- | --- | --- |
| 1 | Blue-Green | Entornos blue y green | Levantar dos instancias del stack de OpsBoard (web+api) compartiendo el mismo Redis. | Obligatoria |
| 2 | Blue-Green | Switch del proxy | Script para que Nginx pase de apuntar a blue a apuntar a green sin cortar el servicio. | Obligatoria |
| 3 | Blue-Green | Rollback | Volver a la version anterior ejecutando el switch inverso, con el tiempo que tarda medido. | Obligatoria |
| 4 | Blue-Green | Diagrama y runbook | Dibujo de la arquitectura blue-green y los comandos exactos para repetir la demo. | Obligatoria |
| 5 | Concurrencia | Asignacion vulnerable | Endpoint que asigna un incidente a un responsable sin control de concurrencia (se puede duplicar). | Obligatoria |
| 6 | Concurrencia | Asignacion protegida | Mismo endpoint usando una operacion atomica de Redis para que solo una solicitud gane. | Obligatoria |
| 7 | Concurrencia | Disparo simultaneo | Script que lanza 2 solicitudes en paralelo contra ambas versiones y guarda la evidencia. | Obligatoria |
| 8 | Concurrencia | Comparativa | Documento que compara la falla (Issue 5) contra la mitigacion (Issue 6) con evidencia del Issue 7. | Obligatoria |
| 9 | CD (opcional) | Workflow de CD a Cloud | Pipeline que despliega automaticamente a EC2 usando el switch blue-green en vez de hacerlo a mano. | Opcional |
| 10 | CD (opcional) | Evidencia del ciclo CD | Capturas/logs de un ciclo completo commit -> build -> deploy automatico -> verificacion. | Opcional |
| 11 | Transversal | Guion de presentacion | Orden de la demo en vivo, comandos a ejecutar y que mostrar si algo falla. | Obligatoria |

## Desglose de Issues propuesto

Formato pensado para el template `Tarea` (Area / Objetivo / Criterios de aceptacion / Dependencias) y los labels `area:*` existentes.

### Tema 1 - Blue-Green deployment

1. **Preparar entornos blue y green en Docker Compose**
   - Area: Infraestructura (`area:infra`)
   - Objetivo: tener dos instancias paralelas del stack de OpsBoard (web+api, blue y green) compartiendo el mismo Redis, para poder alternar entre versiones.
   - Criterios de aceptacion:
     - [ ] Ambos entornos levantan con `docker compose` (a partir del compose existente) y responden en puertos/upstreams distintos.
     - [ ] Comparten la misma instancia de Redis sin perder datos al alternar.
   - Dependencias: ninguna.

2. **Alternar el proxy Nginx entre blue y green sin downtime**
   - Area: Infraestructura (`area:infra`)
   - Objetivo: script o procedimiento para cambiar el upstream activo de Nginx entre blue y green con cero (o minimo) downtime.
   - Criterios de aceptacion:
     - [ ] Existe un comando/script documentado para el switch.
     - [ ] Durante el switch no se observan errores 5xx sostenidos (se verifica con requests continuos).
   - Dependencias: Issue 1.

3. **Ensayar y documentar el rollback**
   - Area: Infraestructura / Documentacion (`area:infra`, `area:docs`)
   - Objetivo: procedimiento para volver a la version anterior ante un problema detectado en la version recien publicada.
   - Criterios de aceptacion:
     - [ ] Se ejecuta un rollback real en el entorno de demo y se verifica que el servicio vuelve a la version previa.
     - [ ] Tiempo de rollback medido y documentado.
   - Dependencias: Issue 2.

4. **Diagrama y runbook de blue-green para la presentacion**
   - Area: Documentacion (`area:docs`)
   - Objetivo: diagrama de arquitectura (blue/green + proxy) y runbook paso a paso para mostrar en la presentacion.
   - Criterios de aceptacion:
     - [ ] Diagrama incluido en el informe o en una carpeta de evidencias.
     - [ ] Runbook con los comandos exactos usados en el ensayo.
   - Dependencias: Issues 1-3.

### Tema 2 - Concurrencia y condiciones de carrera

5. **Endpoint "asignar incidente a un responsable" - version vulnerable**
   - Area: API (`area:api`)
   - Objetivo: agregar al modelo de incidente existente un campo de responsable (`assignedTo`) y un endpoint que lo asigne leyendo el incidente y escribiendolo de vuelta sin control de concurrencia, para poder reproducir la condicion de carrera.
   - Criterios de aceptacion:
     - [ ] Endpoint documentado y reproducible sobre un incidente existente.
     - [ ] Se demuestra que dos solicitudes simultaneas de asignacion sobre el mismo incidente pueden "ganar" las dos (bug reproducido).
   - Dependencias: ninguna.

6. **Version protegida del mismo endpoint**
   - Area: API / Redis (`area:api`, `area:redis`)
   - Objetivo: misma funcionalidad que el Issue 5 pero usando una operacion atomica de Redis (script Lua, `WATCH`+`MULTI`, o `SETNX` sobre la clave del incidente, segun corresponda) para que solo una solicitud logre asignarse el incidente.
   - Criterios de aceptacion:
     - [ ] Con las mismas dos solicitudes simultaneas del Issue 5, solo una obtiene la asignacion.
     - [ ] La solucion elegida y su justificacion quedan documentadas.
   - Dependencias: Issue 5.

7. **Script de disparo simultaneo y evidencia**
   - Area: CI/CD o Infraestructura (`area:ci`)
   - Objetivo: script (curl en paralelo, k6, autocannon o similar) que dispare 2 (o mas) solicitudes concurrentes contra ambas versiones y capture la respuesta/log de cada una.
   - Criterios de aceptacion:
     - [ ] El script corre localmente y contra ambos endpoints (vulnerable y protegido).
     - [ ] Se guardan logs/capturas como evidencia reproducible.
   - Dependencias: Issues 5 y 6.

8. **Comparativa vulnerable vs. protegida para el informe**
   - Area: Documentacion (`area:docs`)
   - Objetivo: documento o seccion del informe que compare ambas versiones (diagrama de la race condition, evidencia del Issue 7, explicacion de la solucion).
   - Criterios de aceptacion:
     - [ ] Incluye evidencia concreta (output del script) de la falla y de la mitigacion.
   - Dependencias: Issue 7.

### Tema 3 - Continuous Delivery (OPCIONAL - no requerido por la catedra)

Hoy el pipeline llega hasta Continuous Integration + publicacion de imagenes en GHCR (`release-ghcr.yml`); el paso a la instancia de AWS EC2 sigue siendo manual (SSH + `docker compose pull && up -d`, ver [docs/cloud-deployment.md](cloud-deployment.md)). El profesor confirmo que automatizar este paso ya no es necesario para el TP2, asi que estas dos tareas quedan como opcionales/plus, sin bloquear al resto.

9. **(Opcional) Workflow de Continuous Delivery hacia Cloud**
   - Area: CI/CD / Cloud (`area:ci`, `area:cloud`)
   - Objetivo: extender el pipeline (o agregar uno nuevo) para que, tras publicar las imagenes en GHCR, se conecte a la instancia EC2 (por ejemplo via SSH action) y ejecute el deploy, reutilizando el switch blue-green del Issue 2 en vez del `docker compose pull && up -d` manual actual.
   - Criterios de aceptacion:
     - [ ] El workflow se dispara automaticamente tras el build (`workflow_run` o job encadenado) y tambien admite `workflow_dispatch` para control manual del momento del switch.
     - [ ] El deploy ejecuta el mecanismo blue-green (Issue 2): sube la version nueva en el entorno inactivo, valida un healthcheck, y recien ahi mueve el proxy.
     - [ ] Si el healthcheck falla, el workflow no mueve el proxy y deja documentado como revertir (reutiliza el rollback del Issue 3).
     - [ ] Se actualiza `docs/cloud-deployment.md` para reflejar que el deploy es automatico y cual es el runbook manual de respaldo.
   - Dependencias: Issues 1, 2 y 3.

10. **(Opcional) Evidencia de un ciclo de CD de punta a punta**
    - Area: Documentacion (`area:docs`)
    - Objetivo: registrar (logs/capturas del workflow) un ciclo completo: commit a `main` -> CI -> build/push a GHCR -> deploy automatico en cloud con blue-green -> verificacion de que el sitio productivo sirve la version nueva.
    - Criterios de aceptacion:
      - [ ] Evidencia del ciclo completo disponible para el informe y la presentacion.
    - Dependencias: Issue 9.

### Transversal

11. **Guion y machete de la presentacion TP2**
    - Area: Documentacion (`area:docs`)
    - Objetivo: guion de demostracion para los temas obligatorios (blue-green y concurrencia), orden de la demo, comandos a ejecutar en vivo, que mostrar si algo falla.
    - Criterios de aceptacion:
      - [ ] Guion ensayado por al menos una persona del equipo.
    - Dependencias: Issues 4 y 8 (Issue 10 es opcional, no bloquea).

## Puntos a confirmar en equipo

Quedan como detalles de implementacion a resolver dentro de cada Issue, no bloquean la creacion de los Issues:

- [ ] Definir el modelo de datos exacto en Redis para el campo `assignedTo` del incidente (clave, estructura, como se representa "sin asignar") — se resuelve en el Issue 5.
- [ ] Definir el mecanismo concreto de acceso SSH del workflow de CD a la instancia EC2 (secret existente vs. nuevo) sin exponer credenciales en logs — se resuelve en el Issue 9 (opcional), si el equipo decide encararlo.
- [ ] Asignar responsables por Issue (se asigna al tomar cada Issue).
- [ ] Revisar si faltan labels (por ejemplo, un label especifico para "concurrencia" o si alcanza con los `area:*` existentes).

## Siguiente paso

El equipo aprobo esta propuesta. Se crea el milestone `M5` agrupando los 11 Issues (Tema 1 y Tema 2 obligatorios, Tema 3 opcional) en GitHub.
