# OpsBoard - Informe Técnico de Entrega y Defensa (TP1)

**Cátedra:** DevOps 2026 | **Institución:** UTN FRRe  
**Proyecto:** OpsBoard — Tablero de Gestión de Incidentes Técnicos  
**Fecha de Entrega:** Lunes 14 de Septiembre de 2026  
**Repositorio Oficial:** [https://github.com/FranDSchz/devops-tp1](https://github.com/FranDSchz/devops-tp1)

---

## 1. Equipo y Distribución de Responsabilidades

El proyecto fue desarrollado por un equipo de 5 integrantes, distribuyendo el alcance técnico de acuerdo a los módulos del sistema y las etapas del ciclo de vida DevOps:

| Integrante | Usuario GitHub | Módulos y Tareas Asignadas |
| :--- | :--- | :--- |
| **Celeste Martín Rodich** | `@universoparalelo` | **Backend & Persistencia:** Modelo de dominio, API REST con Fastify, capa de almacenamiento con Redis y tests de unidad (Issues #1, #2, #3). |
| **Philippe** | `@blob1618` | **Frontend:** Interfaz SPA con React + TypeScript + Vite, manejo de estados, integración con la API REST y tests de componentes (Issue #4). |
| **Mariano Insaurralde** | `@marianoInsa` | **Infraestructura Local & Resiliencia:** Contenerización con Dockerfiles multi-stage, proxy inverso y balanceo con Nginx, réplicas y tolerancia a fallos (Issues #6, #7, #8). |
| **Lautaro Robales** | `@n1krov` | **CI/CD & Seguridad:** Pipelines en GitHub Actions, pruebas automatizadas, análisis estático SAST (CodeQL), escaneo de dependencias/secretos (Trivy) y publicación a GHCR (Issues #5, #9, #10, #11). |
| **Franco D. Sánchez** | `@FranDSchz` | **Cloud & Consolidación:** Despliegue en entorno Cloud desde imágenes de GHCR, arquitectura de producción, informe técnico y guion de coloquio (Issues #12, #13). |

---

## 2. Arquitectura General y Topología del Sistema

OpsBoard implementa una arquitectura desacoplada basada en microservicios contenerizados, orquestados localmente mediante Docker Compose y expuestos a través de un proxy inverso unificado.

```text
                                         RED DOCKER: frontend
                                      +-------------------------+
                                 +--> | opsboard-web-1 (Nginx)  |
                                 |    +-------------------------+
                                 +--> | opsboard-web-2 (Nginx)  |
                                 |    +-------------------------+
Cliente / Navegador              +--> | opsboard-web-3 (Nginx)  |
        |                        |    +-------------------------+
        v                        |
+-------------------+            |       RED DOCKER: backend
|  opsboard-nginx   | (Puerto 80)|    +-------------------------+
|  (Reverse Proxy   |------------+--> | opsboard-api-1 (Fastify)| --+
|  & Load Balancer) |            |    +-------------------------+   |
+-------------------+            +--> | opsboard-api-2 (Fastify)| --+--> [ opsboard-redis ]
                                 |    +-------------------------+   |     (Redis 7 Alpine
                                 +--> | opsboard-api-3 (Fastify)| --+     + Volumen Datos)
                                      +-------------------------+
```

### Principios de Diseño
1. **Punto Único de Entrada:** Nginx es el único servicio expuesto a la red pública/host (puerto `8080` local, `80/443` en cloud). Rutea el tráfico estático (`/`) hacia las réplicas web y las llamadas de datos (`/api/`) hacia las réplicas de la API.
2. **Aislamiento de Red:** La base de datos Redis reside en una red interna privada (`backend`) inaccesible desde el navegador y desde los contenedores web.
3. **Acceso Exclusivo a Redis:** Únicamente los nodos de la API tienen credenciales y conectividad con Redis, cumpliendo de forma estricta la consigna oficial.
4. **Paridad Dev/Prod:** La configuración de red y enrutamiento se mantiene idéntica en el entorno local y en la nube, eliminando problemas de CORS o resolución cruzada de dominios.

---

## 3. Persistencia y Visualización en Redis (Rúbrica: 10 Puntos)

Redis funciona como la capa de persistencia principal para la gestión de incidentes, utilizando estructuras nativas optimizadas y persistencia en disco mediante el comando `appendonly yes` montado en el volumen `redis-data`.

### Modelo de Datos
* **Claves de Incidentes (`Hash`):** Cada incidente se guarda bajo la clave `incident:<uuid>` con los campos:
  * `id`: Identificador único UUID v4.
  * `title`: Título descriptivo del incidente.
  * `service`: Servicio afectado (ej. `web`, `database`, `auth`).
  * `severity`: Nivel de impacto (`low`, `medium`, `high`, `critical`).
  * `status`: Estado actual (`open`, `in_progress`, `resolved`, `closed`).
  * `createdAt` / `updatedAt`: Marcas temporales en formato ISO 8601.
* **Índice Global (`Set`):** Se mantiene una estructura de tipo conjunto bajo la clave `incidents` que almacena los IDs de todos los incidentes activos para permitir consultas eficientes sin usar comandos bloqueantes.

### Procedimiento de Inspección en Vivo
Para verificar las variables almacenadas en el servidor Redis durante el coloquio o en auditoría técnica:

```bash
# 1. Acceder a la CLI de Redis dentro del contenedor en ejecución
docker exec -it opsboard-redis redis-cli

# 2. Listar todos los identificadores de incidentes registrados en el Set
SMEMBERS incidents

# 3. Inspeccionar los campos y valores de un incidente específico
HGETALL incident:<uuid>

# 4. Consultar un campo puntual (ej. estado o severidad)
HGET incident:<uuid> status
HGET incident:<uuid> severity

# 5. Contar la cantidad total de incidentes almacenados
SCARD incidents
```

---

## 4. Balanceo de Carga y Tolerancia a Fallos (Pautas Técnicas)

### Configuración del Balanceador (Nginx)
Nginx distribuye las peticiones entre 3 instancias de backend (`api-1`, `api-2`, `api-3`) mediante un bloque `upstream` configurado con algoritmo Round-Robin por defecto:

```nginx
upstream api_upstream {
    server api-1:3000 max_fails=3 fail_timeout=10s;
    server api-2:3000 max_fails=3 fail_timeout=10s;
    server api-3:3000 max_fails=3 fail_timeout=10s;
}
```

Cada instancia de la API inyecta un encabezado HTTP `X-Instance-ID` en cada respuesta y expone el endpoint `/whoami`, indicando el identificador del contenedor que atendió la solicitud.

### Verificación de Balanceo
Ejecución de solicitudes consecutivas demostrando alternancia de instancias:

```bash
# Bucle de prueba en Bash / PowerShell
for i in {1..6}; do curl -s http://localhost:8080/whoami; echo ""; done
```
**Salida esperada:**
```json
{"instance":"api-1"}
{"instance":"api-2"}
{"instance":"api-3"}
{"instance":"api-1"}
{"instance":"api-2"}
{"instance":"api-3"}
```

### Demostración de Tolerancia a Fallos
1. Se detiene deliberadamente una de las réplicas en ejecución:
   ```bash
   docker stop opsboard-api-2
   ```
2. Se repiten las peticiones al balanceador:
   * Nginx detecta la falta de respuesta en `api-2` y redirige el tráfico de inmediato a `api-1` y `api-3`.
   * La aplicación web continúa operativa sin interrupción ni errores `502 Bad Gateway`.
3. Se restaura el nodo:
   ```bash
   docker start opsboard-api-2
   ```
   * Nginx reintegra el nodo al pool de servidores activos automáticamente.

---

## 5. Pipeline de CI/CD y Seguridad (Rúbrica: 10 pts CI/SAST + 20 pts GHCR)

> ⚠️ **Estado de cumplimiento:**
> - **Pruebas y scripts en el monorepo:** IMPLEMENTADOS (`npm run test`, `npm run typecheck`, `npm run build`). Verificados localmente: Web 7/7 tests pass, Typecheck 100% pass, API 7 pass + 1 falla temporal preexistente conocida en `incidents.test.ts:165`.
> - **Workflows en GitHub Actions:** `[PENDIENTE - ASIGNADO A LAUTARO #9, #10, #11]`. Al 13/09/2026 no existen archivos bajo `.github/workflows/` ni ejecuciones registradas en GitHub Actions (sólo automatizaciones de Copilot).
> - **Badges de CI y Seguridad:** `[PENDIENTE - ASIGNADO A LAUTARO]`. Se incorporarán al `README.md` una vez que los workflows correspondientes se ejecuten con éxito.

### Estructura Planificada del Pipeline
1. **Validación y Pruebas Unitarias (Issue #9):**
   * Instalación determinista mediante `npm ci`.
   * Verificación de tipos TypeScript (`npm run typecheck`).
   * Ejecución de pruebas unitarias con Vitest para API (`apps/api`) y Frontend (`apps/web`).
2. **Análisis Estático SAST y Seguridad (Issue #10):**
   * CodeQL o herramienta aprobada por el equipo (ej. evaluación de Aikido) para SAST.
   * Trivy para escaneo de dependencias (SCA) y detección de secretos.
3. **Publicación en Container Registry (Issue #11):**
   * Construcción y publicación de imágenes Docker para `web` y `api` en GitHub Container Registry:
     * `ghcr.io/frandschz/opsboard-web:latest`
     * `ghcr.io/frandschz/opsboard-api:latest`

---

## 6. Despliegue Cloud desde el Registry (Rúbrica: 20 Puntos)

> ⚠️ **Estado de cumplimiento:**
> - **Preparación de infraestructura cloud:** IMPLEMENTADA Y VALIDADA (`infrastructure/compose/docker-compose.cloud.yml` y `infrastructure/nginx/nginx.cloud.conf` verificados con `docker compose config`).
> - **Procedimiento de despliegue en VM:** DOCUMENTADO en [`docs/cloud-deployment.md`](cloud-deployment.md).
> - **Despliegue real en vivo con URL pública:** `[BLOQUEADO - PENDIENTE DE IMÁGENES EN GHCR #11 Y APROVISIONAMIENTO DE VM]`.
> - En estricto cumplimiento de la consigna, la Issue #12 no se dará por cumplida hasta que el stack corra consumiendo imágenes remotas de GHCR y se verifique la URL pública. Un despliegue local o construido desde código sólo tiene fines de diagnóstico.

### Manifiesto de Despliegue Cloud (`docker-compose.cloud.yml`)
En la máquina virtual de producción el stack consume exclusivamente artefactos publicados:
* `web`: `ghcr.io/frandschz/opsboard-web:latest` (con `INSTANCE_ID: web-cloud-1`).
* `api`: `ghcr.io/frandschz/opsboard-api:latest` (con `INSTANCE_ID: api-cloud-1` y healthcheck en `/health`).
* `redis`: `redis:7-alpine` con volumen persistente `redis-cloud-data`.
* `nginx`: `nginx:alpine` enrutando `/`, `/api/`, `/health`, `/ready` y `/whoami` por el puerto 80 sin problemas de CORS.

---

## 7. Dificultades Encontradas y Soluciones Técnicas

Durante el ciclo de desarrollo se resolvieron desafíos técnicos relevantes:

1. **Gestión de Monorepo en Dockerfiles:**
   * *Problema:* Los contenedores necesitaban resolver las dependencias compartidas del monorepo (`package.json` raíz y `tsconfig.base.json`) sin copiar archivos innecesarios ni romper la caché de capas de Docker.
   * *Solución:* Se implementaron Dockerfiles multi-stage con contexto en la raíz del repositorio, copiando únicamente los manifiestos indispensables en la etapa de build (`npm ci --workspace=...`) y generando artefactos limpios para la etapa de runtime.
2. **Sensibilidad Temporal en Tests de Integración:**
   * *Problema:* En `apps/api/src/store/incidents.test.ts:165`, en ejecuciones rápidas las marcas temporales `createdAt` y `updatedAt` coinciden dentro del mismo milisegundo provocando una falla de aserción estricta (`not.toBe`).
   * *Diagnóstico:* Identificado y documentado como comportamiento preexistente en `docs/evidencia-m2.md`. Requiere flexibilizar la comprobación a consistencia lógica (`updatedAt >= createdAt`).
3. **Identificación de Instancias en Frontend y Proxy:**
   * *Problema:* Se requería mostrar qué réplica atendía el frontend y cuál el backend sin colisiones de ruteo.
   * *Solución:* En PR #17 se implementó `/instance.json` generado dinámicamente al arranque del contenedor web y `/health` / `/ready` en la API, con Nginx configurado con `proxy_pass_header X-Instance-ID` y failover con `proxy_next_upstream`.
4. **Dependencia Externa de Registry para Cloud:**
   * *Problema:* No es posible validar el despliegue final de Cloud sin las imágenes preconstruidas en GHCR.
   * *Solución:* Se desacopló la validación estática de infraestructura (compose y proxy verificados sintácticamente) del despliegue real, dejando el procedimiento listo en `docs/cloud-deployment.md` a la espera de las imágenes.

---

## 8. Posibles Mejoras a Futuro

Para un entorno productivo de mayor escala, se proyectan las siguientes extensiones:
1. **Alta Disponibilidad de Almacenamiento:** Implementación de Redis Sentinel o Redis Cluster con replicación primaria/secundaria y failover automático.
2. **Entrega Continua con GitOps:** Incorporación de herramientas como Watchtower o ArgoCD para automatizar el ciclo de actualización de contenedores en la nube ante un nuevo tag publicado en GHCR.
3. **Observabilidad Integral:** Integración de exportadores de métricas para Prometheus, paneles de visualización en Grafana y centralización de logs estructurados con Grafana Loki o el stack ELK.
4. **Seguridad Perimetral y TLS:** Aprovisionamiento automático de certificados SSL/TLS mediante Let's Encrypt y Certbot montado como contenedor sidecar en Nginx.

---

## 9. Matriz de Cumplimiento de la Rúbrica Oficial (100 Puntos)

| Criterio Oficial | Puntos | Estado | Implementación / Evidencia Técnica | Responsable |
| :--- | :---: | :---: | :--- | :--- |
| **Apps Funcionando (Local)** | 30 | **VERIFICADO** | Monorepo funcional con Web SPA (React), API REST (Fastify) y Redis. Verificado en local (evidencia en `docs/evidencia-m2.md` y suite de pruebas unitarias). | Celeste (Backend), Philippe (Frontend), Mariano (Infra) |
| **Visualización en Redis** | 10 | **VERIFICADO** | Procedimiento reproducible interactivo con `redis-cli` (`SMEMBERS`, `HGETALL`) documentado en `docs/cheatsheet-redis.md` y verificado en `docs/evidencia-m2.md`. | Celeste / Mariano |
| **Balanceo y Tolerancia a Fallos** | Pauta | **VERIFICADO** | 3 nodos Web y 3 nodos API con Nginx Round-Robin, header `X-Instance-ID` y failover automático probado ante detención de contenedor (`docker stop opsboard-api-2`). Evidencia en `docs/evidencia-m2.md`. | Mariano |
| **GitHub Actions en Registry** | 20 | **BLOQUEADO** | Pipeline de build y push a GHCR no implementado en `.github/workflows/`. Requiere publicación de imágenes `opsboard-web` y `opsboard-api`. | Lautaro (Issue #11) |
| **CI (Tests y SAST/SCA)** | 10 | **PENDIENTE** | Pruebas unitarias implementadas en código, pero falta workflow de GitHub Actions (`ci.yml`) y SAST/SCA (CodeQL/Trivy o Aikido) con badges en README. | Lautaro (Issues #9 y #10) |
| **App en Cloud (desde Registry)** | 20 | **BLOQUEADO** | Configuración de Compose y Nginx cloud lista (`infrastructure/compose/docker-compose.cloud.yml`). Despliegue real pendiente de imágenes en GHCR y de aprovisionamiento de VM con URL pública. | Franco (Issue #12) |
| **Coloquio y Presentación** | 10 | **IMPLEMENTADO** | Informe técnico consolidado (`docs/report.md`), matriz de trazabilidad y guion de demostración cronometrado para los 5 integrantes. | Franco (Issue #13) |
| **TOTAL** | **100** | — | — | — |

---

## 10. Guion de Demostración para el Coloquio (10 a 12 Minutos)

Para asegurar la defensa coordinada y la evaluación personal exigida por la cátedra, la presentación se estructura en 5 bloques cronometrados:

* **00:00 - 02:00 | Celeste (Backend y Modelo de Datos):**
  * Presenta la API Fastify y el diseño del almacenamiento en Redis (Hashes y Set índice).
  * Abre terminal y ejecuta en vivo `docker exec -it opsboard-redis redis-cli`, mostrando con `SMEMBERS incidents` y `HGETALL incident:<uuid>` cómo persisten los datos.
* **02:00 - 04:00 | Philippe (Frontend y Experiencia de Usuario):**
  * Muestra la interfaz de OpsBoard en el navegador (<http://localhost:8080>).
  * Crea un incidente, actualiza su estado y muestra el badge de instancias que consulta `/instance.json` y `/health`.
* **04:00 - 06:30 | Mariano (Infraestructura, Balanceo y Tolerancia a Fallos):**
  * Explica la composición local de Docker Compose (3 web + 3 api + Nginx + Redis).
  * Ejecuta el script de peticiones mostrando la rotación de `X-Instance-ID` entre `api-1`, `api-2` y `api-3`.
  * Ejecuta `docker stop opsboard-api-2` y demuestra que la web sigue respondiendo sin error 502 gracias a `proxy_next_upstream`.
* **06:30 - 09:00 | Lautaro (CI/CD, Seguridad y Registry):**
  * Recorre los workflows de GitHub Actions (Vitest, análisis SAST y escaneo de secretos).
  * Muestra los badges verdes en el README y la sección de Packages en GitHub con las imágenes subidas a GHCR.
* **09:00 - 11:30 | Franco (Despliegue Cloud y Cierre):**
  * Presenta la solución desplegada en la nube accediendo a la URL pública.
  * Muestra en los logs del servidor cloud que el stack corre a partir de `docker pull ghcr.io/...`.
  * Sintetiza las dificultades resueltas, la matriz de cumplimiento y las mejoras futuras documentadas en el informe técnico.
