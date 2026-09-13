# Guion de Demostración y Machete del Coloquio (Uso Interno del Equipo)

> 📌 **Documento operativo interno:** Este archivo sirve como guía de ensayo y coordinación para los 5 integrantes durante la defensa oral de 10 a 12 minutos. No forma parte del informe técnico formal entregado a la cátedra.

---

## 1. Reglas Generales del Coloquio
* **Tiempo total estimado:** 10 a 12 minutos (aprox. 2 minutos por integrante).
* **Evaluación:** La nota del coloquio es **individual (10 puntos)**. Todos los integrantes deben intervenir y demostrar dominio de su componente y comprensión de la arquitectura general.
* **Dinámica recomendada:** Un integrante comparte pantalla (o van alternando con fluidez) mientras cada uno habla sobre su módulo en vivo.

---

## 2. Cronograma y Reparto de Bloques

### ⏱️ 00:00 - 02:30 | Bloque 1: Backend y Persistencia (Celeste)
* **Objetivo:** Demostrar el modelo de datos, la API REST y el almacenamiento en Redis.
* **Qué mostrar en pantalla:**
  1. Breve mención a los endpoints de la API (`apps/api/src/routes/incidents.ts`).
  2. Terminal con el cliente interactivo de Redis dentro del contenedor:
     ```bash
     docker exec -it opsboard-redis redis-cli
     ```
  3. Ejecutar los comandos de consulta:
     ```bash
     SMEMBERS incidents
     HGETALL incident:<uuid>
     SCARD incidents
     ```
* **Puntos clave a explicar:** 
  * Por qué se usan Hashes para cada incidente y un Set para indexar los IDs.
  * Por qué solo la API tiene acceso a Redis (aislamiento en la red privada `backend`).

---

### ⏱️ 02:30 - 04:30 | Bloque 2: Frontend y Consumo de API (Philippe)
* **Objetivo:** Demostrar la aplicación web funcionando y la reactividad de la interfaz.
* **Qué mostrar en pantalla:**
  1. La aplicación web abierta en el navegador: [http://localhost:8080](http://localhost:8080).
  2. Crear un nuevo incidente ("Fallo en gateway de pagos", severidad alta).
  3. Cambiar el estado a "resolved" y filtrar por estado.
  4. Mostrar el badge en la esquina de la pantalla que consulta `/instance.json` y `/health`.
* **Puntos clave a explicar:**
  * Consumo bajo el mismo origen (`/api`) a través del proxy inverso, sin problemas de CORS.
  * Manejo de estados asincrónicos (carga, error y reintento).

---

### ⏱️ 04:30 - 07:00 | Bloque 3: Infraestructura Local, Balanceo y Resiliencia (Mariano)
* **Objetivo:** Demostrar la orquestación local, el balanceo Round-Robin y la tolerancia a fallos.
* **Qué mostrar en pantalla:**
  1. El archivo `infrastructure/compose/docker-compose.yml` (3 web + 3 api + Redis + Nginx).
  2. Terminal ejecutando peticiones consecutivas para mostrar la alternancia de réplicas:
     ```bash
     for i in {1..6}; do curl -s http://localhost:8080/health; echo ""; done
     ```
  3. **Prueba de tolerancia a fallos en vivo:**
     ```bash
     docker stop opsboard-api-2
     ```
  4. Repetir las peticiones o refrescar la web mostrando que el servicio sigue respondiendo sin error `502 Bad Gateway`.
  5. Volver a levantar el nodo:
     ```bash
     docker start opsboard-api-2
     ```
* **Puntos clave a explicar:**
  * Rol de Nginx como Reverse Proxy y Load Balancer.
  * Directivas `proxy_next_upstream` y `proxy_pass_header X-Instance-ID`.

---

### ⏱️ 07:00 - 09:30 | Bloque 4: CI/CD, Seguridad y Registry (Lautaro)
* **Objetivo:** Demostrar la automatización, los controles de calidad y la publicación en GHCR.
* **Qué mostrar en pantalla:**
  1. Repositorio en GitHub: pestaña **Actions**.
  2. Workflow de CI ejecutando pruebas unitarias (Vitest) y typecheck.
  3. Workflow de Seguridad (CodeQL / Trivy) y los badges correspondientes en el `README.md`.
  4. Pestaña **Packages** del repositorio mostrando las imágenes publicadas:
     * `ghcr.io/frandschz/opsboard-web`
     * `ghcr.io/frandschz/opsboard-api`
* **Puntos clave a explicar:**
  * Política de Quality Gates: un fallo en pruebas o seguridad bloquea la integración a `main`.
  * Inmutabilidad del contenedor: producción consume imágenes preconstruidas desde el registro.

---

### ⏱️ 09:30 - 12:00 | Bloque 5: Despliegue Cloud, Arquitectura y Cierre (Franco)
* **Objetivo:** Demostrar la solución corriendo en la nube y sintetizar las lecciones aprendidas.
* **Qué mostrar en pantalla:**
  1. La aplicación abierta en el navegador mediante su **URL pública en la nube** (`http://<IP_PUBLICA>/`).
  2. Terminal conectada por SSH a la VM o logs confirmando que los contenedores corren desde GHCR:
     ```bash
     docker compose -f infrastructure/compose/docker-compose.cloud.yml ps
     ```
  3. Crear un incidente en la nube en vivo para certificar la funcionalidad completa.
  4. Mostrar brevemente el informe técnico consolidado (`docs/report.md`).
* **Puntos clave a explicar:**
  * Justificación de la VM IaaS frente a PaaS (evitar *cold starts* en vivo y paridad total con local).
  * Principales dificultades resueltas por el equipo y mejoras a futuro (Redis Sentinel, GitOps).

---

## 3. Checklist Pre-Vuelo (30 Minutos Antes del Coloquio)
- [ ] Docker levantado localmente y stack probado con `docker compose up -d`.
- [ ] Terminales preparadas y limpias con los comandos de prueba listos.
- [ ] VM en la nube encendida y URL pública verificada desde una pestaña de incógnito o celular.
- [ ] Pestañas del navegador abiertas en orden: Repositorio GitHub, Actions, Web local (`localhost:8080`) y Web Cloud.
- [ ] Micrófono y cámara probados por los 5 integrantes.
