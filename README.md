# OpsBoard

[![CI](https://github.com/FranDSchz/devops-tp1/actions/workflows/ci.yml/badge.svg)](https://github.com/FranDSchz/devops-tp1/actions/workflows/ci.yml)
[![Security](https://github.com/FranDSchz/devops-tp1/actions/workflows/security.yml/badge.svg)](https://github.com/FranDSchz/devops-tp1/actions/workflows/security.yml)
[![GHCR Images](https://github.com/FranDSchz/devops-tp1/actions/workflows/release-ghcr.yml/badge.svg)](https://github.com/FranDSchz/devops-tp1/actions/workflows/release-ghcr.yml)

[![Deploy AWS](https://img.shields.io/badge/AWS%20Cloud-3.17.23.16-orange?logo=amazon-aws)](http://3.17.23.16)

Trabajo Practico 1 de DevOps - UTN FRRe 2026.

> 🌐 **Despliegue Cloud en Producción (En vivo):** [http://3.17.23.16](http://3.17.23.16)  
> Stack orquestado con Docker Compose en AWS EC2 (Ubuntu 24.04 LTS), consumiendo artefactos inmutables publicados en GitHub Container Registry (GHCR) y protegido mediante Nginx reverse proxy y Security Groups.

OpsBoard es una aplicacion web contenerizada para registrar y gestionar incidentes de infraestructura. El objetivo central del proyecto es demostrar un flujo DevOps integral: contenedores, réplicas, balanceo con tolerancia a fallos, integración continua, análisis de seguridad (SAST/SCA), publicación inmutable de imágenes y despliegue en la nube.

## Estado

- **M0**: completado (documentacion, plantillas y organizacion inicial).
- **M1**: completado (aplicacion base: API, web y tests unitarios).
- **M2**: completado (contenedores, Nginx, tres replicas web y tres API, balanceo y tolerancia a fallos).
- **M3**: completado (CI, seguridad CodeQL/Trivy y Registry GHCR).
- **M4**: completado (despliegue en AWS EC2 desde GHCR y documentacion técnica consolidada).

La aplicacion es ejecutable localmente y en la nube: ver [Ejecucion local](#ejecucion-local-docker-compose) y [Despliegue en Cloud](#despliegue-en-cloud-aws-ec2).

Fecha de entrega indicada en la consigna: **lunes 14 de septiembre de 2026**.

## Alcance funcional minimo

- Crear un incidente.
- Listar los incidentes almacenados.
- Cambiar el estado de un incidente.
- Eliminar un incidente.
- Guardar y recuperar la informacion mediante Redis.

Cada incidente cuenta con atributos tipados: `id` (UUID), `title`, `service`, `severity`, `status`, `createdAt` y `updatedAt`.

## Arquitectura del Sistema

OpsBoard implementa una arquitectura desacoplada en microservicios contenerizados, aplicando el patrón **Dual-Homed Reverse Proxy**, **Defensa en Profundidad** y la política de **Same-Origin** (Zero CORS) mediante Nginx.

El proyecto cuenta con dos entornos de ejecución:
1. **Entorno Local (Desarrollo & Resiliencia Multi-Réplica):** Ejecuta 3 réplicas de Web, 3 réplicas de API, Redis con persistencia y Nginx balanceando con Round-Robin y conmutación automática ante fallos en menos de 2 segundos.
2. **Entorno Cloud (Producción en AWS EC2):** Ejecuta el stack productivo en una máquina virtual Linux en AWS consumiendo artefactos inmutables publicados en GitHub Container Registry (GHCR), protegido perimetralmente con Security Groups.

### 1. Topología Local Multi-Réplica (Alta Disponibilidad y Tolerancia a Fallos)

```mermaid
flowchart TD
    Client["Cliente / Navegador Web"] -- "HTTP :8080" --> NGINX["opsboard-nginx<br>(Reverse Proxy & Load Balancer)"]

    subgraph NetFront["Red Docker: frontend (Aislada)"]
        UP_WEB["upstream web_upstream<br>(Round-Robin)"]
        W1["opsboard-web-1 (:80)"]
        W2["opsboard-web-2 (:80)"]
        W3["opsboard-web-3 (:80)"]
        UP_WEB --> W1 & W2 & W3
    end

    subgraph NetBack["Red Docker: backend (Privada)"]
        UP_API["upstream api_upstream<br>(Round-Robin + Failover &lt;2s)"]
        A1["opsboard-api-1 (:3000)"]
        A2["opsboard-api-2 (:3000)"]
        A3["opsboard-api-3 (:3000)"]
        
        REDIS[("opsboard-redis<br>(Redis 7 Alpine :6379)")]
        VOL[("Volumen Persistente<br>redis-data -> /data")]
        
        UP_API --> A1 & A2 & A3
        A1 & A2 & A3 -- "TCP :6379" --> REDIS
        REDIS --- VOL
    end

    NGINX -- "Path / (Activos SPA y /instance.json)" --> UP_WEB
    NGINX -- "Path /api/*, /health, /ready, /whoami" --> UP_API
```

### 2. Topología Cloud en Producción (AWS EC2 + GHCR)

```mermaid
flowchart TD
    Internet["Internet / Clientes Públicos"] -- "HTTP :80" --> SG["AWS Security Group: opsboard-sg<br>(Inbound: TCP 80 & 22 | Bloqueados: 3000 & 6379)"]

    subgraph AWS["Instancia AWS EC2 (t3.micro - Ubuntu 24.04 LTS | IP: 3.17.23.16)"]
        SG --> C_NGINX["opsboard-cloud-nginx<br>(Nginx Alpine :80)"]

        subgraph DockerCloudFront["Red Docker: cloud-frontend"]
            C_WEB["opsboard-cloud-web (:80)<br>Imagen: ghcr.io/.../opsboard-web:latest"]
        end

        subgraph DockerCloudBack["Red Docker: cloud-backend (Aislada de Internet)"]
            C_API["opsboard-cloud-api (:3000)<br>Imagen: ghcr.io/.../opsboard-api:latest"]
            C_REDIS[("opsboard-cloud-redis (:6379)<br>Redis 7 Alpine")]
            C_VOL[("Volumen Persistente<br>redis-cloud-data -> /data")]
            
            C_API -- "TCP :6379" --> C_REDIS
            C_REDIS --- C_VOL
        end

        C_NGINX -- "Path / (Activos SPA)" --> C_WEB
        C_NGINX -- "Path /api/*, /health, /ready" --> C_API
    end

    subgraph GHCR["GitHub Container Registry (Inmutable)"]
        GHCR_WEB[("ghcr.io/frandschz/opsboard-web:latest")]
        GHCR_API[("ghcr.io/frandschz/opsboard-api:latest")]
    end

    GHCR_WEB -.->|"docker compose pull"| C_WEB
    GHCR_API -.->|"docker compose pull"| C_API
```

### 3. Pipeline de Entrega Continua y Despliegue Inmutable

```mermaid
flowchart LR
    subgraph Dev["Desarrollo"]
        Code["Código TypeScript"] --> PR["Pull Request a 'main'"]
    end

    subgraph CI_CD["GitHub Actions"]
        PR --> CI["TypeCheck + Vitest<br>(31 Tests Aprobados)"]
        CI --> SEC["CodeQL SAST + Trivy SCA/Secrets"]
        SEC -- "Merge a 'main'" --> Build["Multi-Stage Build"]
        Build --> Push["docker push a GHCR"]
    end

    subgraph Registry["GitHub Packages"]
        Push --> GHCR_REPO[("GHCR: opsboard-web & opsboard-api")]
    end

    subgraph Cloud["AWS EC2 (Producción)"]
        GHCR_REPO -.->|"docker compose pull"| Run["docker compose up -d"]
        Run --> Live["En vivo: http://3.17.23.16"]
    end
```

La arquitectura completa con proxy y réplicas se ejecuta localmente mediante Docker Compose. En Cloud (AWS EC2), se ejecuta el stack productivo (`docker-compose.cloud.yml`) consumiendo exclusivamente las imágenes inmutables de GHCR.

## Decisiones tecnicas

| Area | Decision |
| --- | --- |
| Frontend | React, Vite y TypeScript |
| API | Fastify y TypeScript |
| Almacenamiento | Redis 7 Alpine con volumen persistente |
| Reverse proxy | Nginx con Round-Robin y Failover |
| Orquestacion local | Docker Compose |
| Tests | Vitest (31 pruebas unitarias aprobadas) |
| SAST | CodeQL oficial de GitHub |
| SCA y Secrets | Aqua Trivy |
| Registry | GitHub Container Registry (GHCR) |
| Despliegue Cloud | AWS EC2 (Ubuntu 24.04 LTS en t3.micro) con Docker Compose |
| Flujo de trabajo | GitHub Flow con protección de rama `main` |

## Organizacion del repositorio

El proyecto se desarrollara como monorepo:

```text
apps/
  web/
  api/
infrastructure/
  nginx/
  compose/
docs/
.github/
```

## Ejecucion local (Docker Compose)

Requisitos:

- Docker instalado.
- Docker Compose **v2** (comando `docker compose` con un espacio, no `docker-compose`).

Verificar la instalacion:

```bash
docker --version
docker compose version
```

Levantar el stack completo:

```bash
# Desde la raiz del repositorio
cd infrastructure/compose
docker compose up --build
```

La aplicacion queda disponible en <http://localhost:8080>. Nginx expone el unico puerto de entrada (`8080`) y balancea entre 3 nodos web y 3 nodos API.

- Redis se ejecuta en su propio contenedor con un volumen persistente.
- Cada nodo API responde el header `X-Instance-ID` y el endpoint `/health` devuelve la instancia que lo atendio (permite demostrar el balanceo).

Para detener el stack: `docker compose down` (agregar `-v` para borrar tambien el volumen de Redis).

### Demostrar el balanceo

Ver que distintas replicas API atienden cada peticion:

```bash
for i in {1..9}; do curl -s http://localhost:8080/health; echo; done
```

Se observan respuestas alternadas entre `api-1`, `api-2` y `api-3`.

### Demostrar tolerancia a la caida de una instancia

1. Detener una replica (por ejemplo `api-2`):

```bash
docker stop opsboard-api-2
```

2. Repetir las peticiones y comprobar que el servicio sigue respondiendo:

```bash
for i in {1..6}; do curl -s http://localhost:8080/health; echo; done
```

Solo responden las instancias activas (`api-1` y `api-3`).

3. Volver a levantar la instancia detenida:

```bash
docker start opsboard-api-2
```

Para inspeccionar los datos en Redis ver [cheatsheet-redis.md](docs/cheatsheet-redis.md).

## Despliegue en Cloud (AWS EC2)

La solución se encuentra desplegada y operativa en una máquina virtual Linux en AWS:

- **URL Pública (Acceso directo):** [http://3.17.23.16](http://3.17.23.16)
- **Infraestructura:** AWS EC2 `t3.micro` (Ubuntu 24.04 LTS, región Ohio `us-east-2`, Security Group `opsboard-sg` con puertos 22 y 80).
- **Inmutabilidad de Artefactos:** Despliegue mediante Docker Compose (`infrastructure/compose/docker-compose.cloud.yml`) consumiendo exclusivamente imágenes publicadas en GitHub Container Registry:
  - `ghcr.io/frandschz/opsboard-web:latest`
  - `ghcr.io/frandschz/opsboard-api:latest`
- **Endpoints de Diagnóstico y Salud:**
  - Frontend SPA: [http://3.17.23.16/](http://3.17.23.16/)
  - Healthcheck API: [http://3.17.23.16/health](http://3.17.23.16/health) (`{"status":"ok","instance":"api-cloud-1"}`)
  - Readiness (Redis ping): [http://3.17.23.16/ready](http://3.17.23.16/ready)
  - Frontend Instance: [http://3.17.23.16/instance.json](http://3.17.23.16/instance.json) (`{"instance":"web-cloud-1"}`)
  - API REST Incidentes: [http://3.17.23.16/api/incidents](http://3.17.23.16/api/incidents)
- Para más detalles sobre el aprovisionamiento, firewall y runbook operativo, ver [docs/cloud-deployment.md](docs/cloud-deployment.md).

## Colaboracion

- Cada cambio comienza con un Issue.
- Cada Issue se implementa en una rama corta.
- Los cambios ingresan a `main` mediante Pull Request.
- Cada Pull Request necesita revision de al menos otro integrante.
- `main` debe mantenerse en estado estable.
- Todos los integrantes deben comprender la arquitectura completa para el coloquio.

Consultar [CONTRIBUTING.md](CONTRIBUTING.md) antes de comenzar una tarea.

## Documentacion

- [Requisitos y criterios de evaluacion](docs/requirements.md)
- [Arquitectura del sistema](docs/architecture.md)
- [Decisiones del proyecto](docs/decisions.md)
- [Roadmap de entregas](docs/roadmap.md)
- [Estrategia y casos de pruebas unitarias](docs/tests.md)
- [Estrategia de seguridad, SAST y SCA](docs/security.md)
- [Publicacion y uso de imagenes en GHCR](docs/registry.md)
- [Procedimiento de despliegue en Cloud (AWS EC2)](docs/cloud-deployment.md)
- [Evidencias de balanceo, tolerancia a fallos y Redis](docs/evidencia-m2.md)
- [Cheatsheet de consultas y operaciones en Redis](docs/cheatsheet-redis.md)
- [Guion de demostracion y machete del coloquio](docs/guion-coloquio.md)
- [Informe tecnico de entrega](docs/report.md)

## Entregables previstos

- Aplicacion funcionando durante el coloquio.
- Repositorio grupal publico.
- Imagenes publicadas en GHCR mediante GitHub Actions.
- Aplicacion desplegada en un servicio cloud desde el Registry.
- Informe o presentacion con resultados, dificultades y mejoras futuras.
- Demostracion de Redis, balanceo y tolerancia a la caida de una instancia.

