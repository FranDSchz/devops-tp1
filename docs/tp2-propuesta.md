# Propuesta de organizacion - TP2

Este documento es una propuesta para discutir en equipo antes de crear el milestone y los Issues definitivos en GitHub. No reemplaza al roadmap de TP1 ([docs/roadmap.md](roadmap.md)); lo extiende con los dos temas nuevos a presentar.

## Consigna

> 1. Despliegue: blue-green deployment. Como publicar una version con cambio rapido y rollback de bajo riesgo? Ejecutar versiones azul y verde, alternar el proxy entre ellas y volver a la anterior.
> 2. Consistencia: condiciones de carrera y controles de concurrencia. Como impedir que dos procesos asignen el mismo recurso? Lanzar dos solicitudes simultaneas sobre un unico cupo y comparar una version vulnerable con otra protegida.

## Milestone propuesto

**M5 - TP2: Blue-Green y Concurrencia**

Descripcion sugerida: Despliegue blue-green con rollback de bajo riesgo y control de condiciones de carrera en la asignacion de un recurso con cupo unico.

## Desglose de Issues propuesto

Formato pensado para el template `Tarea` (Area / Objetivo / Criterios de aceptacion / Dependencias) y los labels `area:*` existentes.

### Tema 1 - Blue-Green deployment

1. **Preparar entornos blue y verde en Docker Compose**
   - Area: Infraestructura (`area:infra`)
   - Objetivo: tener dos stacks paralelos de web+api (blue y verde) compartiendo el mismo Redis, para poder alternar entre versiones.
   - Criterios de aceptacion:
     - [ ] Ambos entornos levantan con `docker compose` y responden en puertos/upstreams distintos.
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

5. **Modelar el recurso con cupo unico - version vulnerable**
   - Area: API (`area:api`)
   - Objetivo: endpoint que asigna un recurso con cupo limitado (por ejemplo, asignar un incidente a un unico responsable, o reservar un slot) usando lectura-y-escritura sin control de concurrencia, para poder reproducir la condicion de carrera.
   - Criterios de aceptacion:
     - [ ] Endpoint documentado y reproducible.
     - [ ] Se demuestra que dos solicitudes simultaneas pueden asignar el mismo cupo dos veces (bug reproducido).
   - Dependencias: ninguna.

6. **Version protegida del mismo endpoint**
   - Area: API / Redis (`area:api`, `area:redis`)
   - Objetivo: misma funcionalidad que el Issue 5 pero usando una operacion atomica de Redis (script Lua, `WATCH`+`MULTI`, o `SETNX`/`INCR` segun corresponda) para evitar la doble asignacion.
   - Criterios de aceptacion:
     - [ ] Con las mismas dos solicitudes simultaneas del Issue 5, solo una obtiene el cupo.
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

### Transversal

9. **Guion y machete de la presentacion TP2**
   - Area: Documentacion (`area:docs`)
   - Objetivo: guion de demostracion para ambos temas (orden de la demo, comandos a ejecutar en vivo, que mostrar si algo falla).
   - Criterios de aceptacion:
     - [ ] Guion ensayado por al menos una persona del equipo.
   - Dependencias: Issues 4 y 8.

## Puntos a confirmar en equipo

- [ ] Elegir el recurso concreto para el Tema 2 (ejemplo propuesto: asignar un incidente a un unico responsable, o reservar un "cupo" de atencion). Definir el modelo de datos exacto en Redis.
- [ ] Decidir si el Tema 1 reutiliza el stack de OpsBoard (web+api+redis) o un servicio mas simple solo para la demo.
- [ ] Confirmar si se agrupan los 9 Issues en un solo milestone M5 o se separan en dos (uno por tema).
- [ ] Asignar responsables por Issue.
- [ ] Revisar si faltan labels (por ejemplo, un label especifico para "concurrencia" o si alcanza con los `area:*` existentes).

## Siguiente paso

Una vez que el equipo revise y ajuste esta propuesta (via comentarios en el Pull Request o en la reunion), se crea el milestone `M5` y los Issues definitivos en GitHub siguiendo el template `Tarea`, igual que en TP1.
