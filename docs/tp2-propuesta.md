# Propuesta de organizacion - TP2

Este documento es una propuesta para discutir en equipo antes de crear el milestone y los Issues definitivos en GitHub. No reemplaza al roadmap de TP1 ([docs/roadmap.md](roadmap.md)); lo extiende con los dos temas nuevos a presentar.

## Consigna

> 1. Despliegue: blue-green deployment. Como publicar una version con cambio rapido y rollback de bajo riesgo? Ejecutar versiones azul y verde, alternar el proxy entre ellas y volver a la anterior.
> 2. Consistencia: condiciones de carrera y controles de concurrencia. Como impedir que dos procesos asignen el mismo recurso? Lanzar dos solicitudes simultaneas sobre un unico cupo y comparar una version vulnerable con otra protegida.

## Milestone propuesto

**M5 - TP2: Blue-Green y Concurrencia**

Descripcion sugerida: Despliegue blue-green con rollback de bajo riesgo y control de condiciones de carrera en la asignacion de un recurso con cupo unico.

## Decisiones confirmadas

- **Se trabaja sobre el proyecto existente (OpsBoard)**, no se arma una app o servicio nuevo para la demo.
- **Tema 1 (blue-green)**: se reutiliza el stack completo de OpsBoard (web + api + Redis) de [infrastructure/compose](../infrastructure/compose). Blue y verde son dos instancias de ese mismo stack compartiendo Redis, no un servicio simplificado aparte.
- **Tema 2 (concurrencia)**: el recurso con cupo unico es el modelo de incidentes que ya existe. El caso concreto propuesto es **asignar un incidente a un unico responsable** (agregar un campo tipo `assignedTo` al incidente existente): dos solicitudes simultaneas intentan tomar el mismo incidente y solo una debe ganarlo. No se modela un dominio nuevo.

## Desglose de Issues propuesto

Formato pensado para el template `Tarea` (Area / Objetivo / Criterios de aceptacion / Dependencias) y los labels `area:*` existentes.

### Tema 1 - Blue-Green deployment

1. **Preparar entornos blue y verde en Docker Compose**
   - Area: Infraestructura (`area:infra`)
   - Objetivo: tener dos instancias paralelas del stack de OpsBoard (web+api, blue y verde) compartiendo el mismo Redis, para poder alternar entre versiones.
   - Criterios de aceptacion:
     - [ ] Ambos entornos levantan con `docker compose` (a partir del compose existente) y responden en puertos/upstreams distintos.
     - [ ] Comparten la misma instancia de Redis sin perder datos al alternar.
   - Dependencias: ninguna.

2. **Alternar el proxy Nginx entre blue y verde sin downtime**
   - Area: Infraestructura (`area:infra`)
   - Objetivo: script o procedimiento para cambiar el upstream activo de Nginx entre blue y verde con cero (o minimo) downtime.
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
   - Objetivo: diagrama de arquitectura (blue/verde + proxy) y runbook paso a paso para mostrar en la presentacion.
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

### Tema 3 - Continuous Delivery (automatizar el despliegue)

Hoy el pipeline llega hasta Continuous Integration + publicacion de imagenes en GHCR (`release-ghcr.yml`); el paso a la instancia de AWS EC2 sigue siendo manual (SSH + `docker compose pull && up -d`, ver [docs/cloud-deployment.md](cloud-deployment.md)). Esto cierra ese gap y ademas sirve como el mecanismo que dispara el switch blue-green del Tema 1 en vez de ejecutarlo a mano.

9. **Workflow de Continuous Delivery hacia Cloud**
   - Area: CI/CD / Cloud (`area:ci`, `area:cloud`)
   - Objetivo: extender el pipeline (o agregar uno nuevo) para que, tras publicar las imagenes en GHCR, se conecte a la instancia EC2 (por ejemplo via SSH action) y ejecute el deploy, reutilizando el switch blue-green del Issue 2 en vez del `docker compose pull && up -d` manual actual.
   - Criterios de aceptacion:
     - [ ] El workflow se dispara automaticamente tras el build (`workflow_run` o job encadenado) y tambien admite `workflow_dispatch` para control manual del momento del switch.
     - [ ] El deploy ejecuta el mecanismo blue-green (Issue 2): sube la version nueva en el entorno inactivo, valida un healthcheck, y recien ahi mueve el proxy.
     - [ ] Si el healthcheck falla, el workflow no mueve el proxy y deja documentado como revertir (reutiliza el rollback del Issue 3).
     - [ ] Se actualiza `docs/cloud-deployment.md` para reflejar que el deploy es automatico y cual es el runbook manual de respaldo.
   - Dependencias: Issues 1, 2 y 3.

10. **Evidencia de un ciclo de CD de punta a punta**
    - Area: Documentacion (`area:docs`)
    - Objetivo: registrar (logs/capturas del workflow) un ciclo completo: commit a `main` -> CI -> build/push a GHCR -> deploy automatico en cloud con blue-green -> verificacion de que el sitio productivo sirve la version nueva.
    - Criterios de aceptacion:
      - [ ] Evidencia del ciclo completo disponible para el informe y la presentacion.
    - Dependencias: Issue 9.

### Transversal

11. **Guion y machete de la presentacion TP2**
    - Area: Documentacion (`area:docs`)
    - Objetivo: guion de demostracion para los tres temas (orden de la demo, comandos a ejecutar en vivo, que mostrar si algo falla).
    - Criterios de aceptacion:
      - [ ] Guion ensayado por al menos una persona del equipo.
    - Dependencias: Issues 4, 8 y 10.

## Puntos a confirmar en equipo

- [ ] Definir el modelo de datos exacto en Redis para el campo `assignedTo` del incidente (clave, estructura, como se representa "sin asignar").
- [ ] Confirmar si se agrupan los 11 Issues en un solo milestone M5 o se separan por tema (blue-green / concurrencia / CD).
- [ ] Definir el mecanismo concreto de acceso SSH del workflow de CD a la instancia EC2 (secret existente vs. nuevo) sin exponer credenciales en logs.
- [ ] Asignar responsables por Issue.
- [ ] Revisar si faltan labels (por ejemplo, un label especifico para "concurrencia" o si alcanza con los `area:*` existentes).

## Siguiente paso

Una vez que el equipo revise y ajuste esta propuesta (via comentarios en el Pull Request o en la reunion), se crea el milestone `M5` y los Issues definitivos en GitHub siguiendo el template `Tarea`, igual que en TP1.
