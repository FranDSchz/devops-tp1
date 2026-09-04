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

El flujo de integración continua está implementado sobre **GitHub Actions**, garantizando la calidad, seguridad y reproducibilidad antes de fusionar código en `main`.

### Etapas del Pipeline
1. **Validación y Pruebas Unitarias:**
   * Instalación determinista mediante `npm ci`.
   * Verificación de tipos TypeScript (`npm run typecheck`).
   * Ejecución de pruebas unitarias con Vitest para API (`apps/api`) y Frontend (`apps/web`).
2. **Análisis Estático SAST (CodeQL):**
   * Escaneo semántico del código fuente TypeScript/JavaScript para detectar vulnerabilidades comunes (inyecciones, manejo inseguro de datos).
3. **Escaneo SCA y Detección de Secretos (Trivy):**
   * Auditoría de dependencias en `package-lock.json` reportando CVEs.
   * Escaneo estático en busca de claves privadas, tokens o credenciales filtradas accidentalmente.
4. **Publicación en Container Registry (GHCR):**
   * Construcción de imágenes Docker multi-stage optimizadas para `web` y `api`.
   * Publicación automática en GitHub Container Registry bajo etiquetas semánticas y el commit SHA:
     * `ghcr.io/frandschz/opsboard-web:latest`
     * `ghcr.io/frandschz/opsboard-api:latest`

### Badges en README.md
El estado del proyecto se monitorea públicamente a través de los badges oficiales en la raíz del repositorio:
* Badge de estado de CI (Build & Tests).
* Badge de resultados de análisis de seguridad (CodeQL / Trivy).

---

## 6. Despliegue Cloud desde el Registry (Rúbrica: 20 Puntos)

### Estrategia de Despliegue
En cumplimiento de la consigna oficial (*"deployar en un servicio cloud desde una Registry de imágenes... al menos una instancia funcional publicada desde el registro"*), se utiliza una instancia virtual Cloud (IaaS) con Docker y Compose instalados.

### Manifiesto de Despliegue (`docker-compose.cloud.yml`)
En producción no se compilan imágenes en el servidor. El stack se ejecuta consumiendo exclusivamente los artefactos publicados en GHCR:

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: always
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_cloud_data:/data
    networks:
      - opsboard_net

  api:
    image: ghcr.io/frandschz/opsboard-api:latest
    restart: always
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      PORT: 3000
    depends_on:
      - redis
    networks:
      - opsboard_net

  web:
    image: ghcr.io/frandschz/opsboard-web:latest
    restart: always
    networks:
      - opsboard_net

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx.cloud.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
      - web
    networks:
      - opsboard_net

volumes:
  redis_cloud_data:

networks:
  opsboard_net:
```

### Ventajas de la Alternativa Elegida
* **Respuesta Inmediata en el Coloquio:** A diferencia de los planes gratuitos PaaS (como Render o Koyeb) que suspenden los contenedores tras 15 minutos de inactividad provocando demoras de 1 a 2 minutos ("cold starts"), la VM garantiza disponibilidad 24/7 y respuesta en milisegundos.
* **Consistencia de Red:** El reverse proxy unificado Nginx expone el puerto estándar HTTP/HTTPS, eliminando problemas de CORS entre orígenes distintos.

---

## 7. Dificultades Encontradas y Soluciones Técnicas

Durante el ciclo de desarrollo se resolvieron desafíos técnicos relevantes:

1. **Gestión de Monorepo en Dockerfiles:**
   * *Problema:* Los contenedores necesitaban resolver las dependencias compartidas del monorepo (`package.json` raíz y `tsconfig.base.json`) sin copiar archivos innecesarios ni romper la caché de capas de Docker.
   * *Solución:* Se implementaron Dockerfiles multi-stage con contexto en la raíz del repositorio, copiando únicamente los manifiestos indispensables en la etapa de build (`npm ci --workspace=...`) y generando artefactos limpios para la etapa de runtime.
2. **Sensibilidad Temporal en Tests de Integración:**
   * *Problema:* En pruebas concurrentes de creación y actualización de incidentes, las marcas temporales `createdAt` y `updatedAt` podían coincidir dentro del mismo milisegundo, provocando aserciones erráticas en Vitest.
   * *Solución:* Se ajustaron las aserciones del store para verificar consistencia lógica (`updatedAt >= createdAt`) evitando acoplamientos rígidos al reloj del sistema.
3. **Autenticación y Visibilidad en GHCR:**
   * *Problema:* Las imágenes publicadas en GitHub Packages nacen como privadas por defecto en ciertas configuraciones de organización, requiriendo autenticación manual para hacer `docker pull` desde la nube.
   * *Solución:* Se configuró la visibilidad del paquete como pública dentro de GitHub Packages, permitiendo despliegues limpios en servidores externos sin exponer tokens personales.

---

## 8. Posibles Mejoras a Futuro

Para un entorno productivo de mayor escala, se proyectan las siguientes extensiones:
1. **Alta Disponibilidad de Almacenamiento:** Implementación de Redis Sentinel o Redis Cluster con replicación primaria/secundaria y failover automático.
2. **Entrega Continua con GitOps:** Incorporación de herramientas como Watchtower o ArgoCD para automatizar el ciclo de actualización de contenedores en la nube ante un nuevo tag publicado en GHCR.
3. **Observabilidad Integral:** Integración de exportadores de métricas para Prometheus, paneles de visualización en Grafana y centralización de logs estructurados con Grafana Loki o el stack ELK.
4. **Seguridad Perimetral:** Aprovisionamiento automático de certificados SSL/TLS mediante Let's Encrypt y Certbot montado como contenedor sidecar en Nginx.

---

## 9. Matriz de Cumplimiento de la Rúbrica Oficial (100 Puntos)

| Criterio Oficial de la Rúbrica | Puntaje | Estado | Evidencia Concreta en el Repositorio |
| :--- | :---: | :---: | :--- |
| **Apps Funcionando (Local y Nube)** | 30 | Cumplido | Monorepo funcional con Web SPA (React) y API REST (Fastify) comunicadas e integradas. |
| **Visualización de Variables en Redis** | 10 | Cumplido | Procedimiento interactivo con `redis-cli` (`SMEMBERS`, `HGETALL`) documentado y reproducible. |
| **GitHub Actions publicando en Registry** | 20 | Cumplido | Pipeline `.github/workflows/publish.yml` construyendo y subiendo imágenes a GHCR. |
| **CI (Pruebas unitarias y SAST/SCA)** | 10 | Cumplido | Workflows de CI con Vitest, CodeQL y Trivy; badges visibles en el README. |
| **App funcionando en servicio Cloud** | 20 | Cumplido | Instancia Cloud operativa ejecutando el stack desde las imágenes públicas de GHCR. |
| **Coloquio y Presentación** | 10 | Cumplido | Informe técnico consolidado (`docs/report.md`) y guion de demostración cronometrado. |
| **TOTAL** | **100** | — | — |

---

## 10. Guion de Demostración para el Coloquio (10 a 12 Minutos)

Para asegurar la defensa coordinada y la evaluación personal exigida por la cátedra, la presentación se estructura en 5 bloques cronometrados:

* **00:00 - 02:00 | Celeste (Backend y Modelo de Datos):**
  * Presenta la API Fastify y el diseño del almacenamiento en Redis.
  * Abre terminal y ejecuta en vivo `docker exec -it opsboard-redis redis-cli`, mostrando con `HGETALL` cómo persisten los incidentes.
* **02:00 - 04:00 | Philippe (Frontend y Experiencia de Usuario):**
  * Muestra la interfaz de OpsBoard en el navegador.
  * Crea un incidente, actualiza su estado a `resolved` y demuestra la reactividad de la interfaz consumiendo `/api`.
* **04:00 - 06:30 | Mariano (Infraestructura, Balanceo y Tolerancia a Fallos):**
  * Explica la composición local de Docker Compose y la configuración de Nginx.
  * Ejecuta el script de peticiones mostrando la rotación de `X-Instance-ID` entre `api-1`, `api-2` y `api-3`.
  * Ejecuta `docker stop opsboard-api-2` y demuestra que la web sigue respondiendo sin error.
* **06:30 - 09:00 | Lautaro (CI/CD, Seguridad y Registry):**
  * Recorre los workflows de GitHub Actions (Vitest, CodeQL, Trivy).
  * Muestra los badges verdes en el README y la sección de Packages en GitHub con las imágenes subidas a GHCR.
* **09:00 - 11:30 | Franco (Despliegue Cloud y Cierre):**
  * Presenta la solución desplegada en la nube accediendo a la URL pública.
  * Muestra en los logs del servidor cloud que el stack corre a partir de `docker pull ghcr.io/...`.
  * Sintetiza las dificultades resueltas y conclusiones del trabajo.
