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

El proyecto cuenta con dos entornos de ejecución, con topología idéntica:

| | Entorno local | Entorno cloud (AWS EC2) |
| --- | --- | --- |
| Entrada | Nginx en `:8080` | Nginx en `:80` detrás de Security Group |
| Réplicas web | 3 | 3 |
| Réplicas API | 3 | 3 |
| Persistencia | Redis 7 Alpine (`redis-data`) | Redis 7 Alpine (`redis-cloud-data`) |
| Imágenes | Build local | Exclusivamente `ghcr.io/frandschz/opsboard-*` |
| Comando | `docker compose up --build` | `docker compose -f docker-compose.cloud.yml up -d` |

Los diagramas de topología, el modelo de datos en Redis y la configuración de failover están en [docs/architecture.md](docs/architecture.md).

### Pipeline de Entrega Continua y Despliegue Inmutable


```mermaid
flowchart LR
    subgraph Dev["Desarrollo"]
        Code["Código TypeScript"] --> PR["Pull Request a 'main'"]
    end

    subgraph CI_CD["GitHub Actions"]
        PR --> CI["TypeCheck + Vitest<br>(54 Tests Aprobados)"]
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

## Stack

| Area | Tecnologia |
| --- | --- |
| Frontend | React, Vite y TypeScript |
| API | Fastify y TypeScript |
| Almacenamiento | Redis 7 Alpine con volumen persistente |
| Reverse proxy | Nginx con Round-Robin y Failover |
| Tests | Vitest (54 pruebas unitarias aprobadas) |
| Seguridad | CodeQL (SAST) y Trivy (SCA y Secrets) |
| Registry | GitHub Container Registry (GHCR) |
| Cloud | AWS EC2 (Ubuntu 24.04 LTS en t3.micro) con Docker Compose |

El detalle de cada decision y su motivo esta en [docs/decisions.md](docs/decisions.md).

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
- Cada nodo API registra un latido en Redis y `GET /api/instances` devuelve la flota completa; la web lo muestra en el panel "Réplicas del servicio".

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

Para inspeccionar los datos en Redis ver [cheatsheet-redis.md](docs/cheatsheet-redis.md). Para consultar la flota en vivo:

```bash
curl -s http://localhost:8080/api/instances | jq .
```

## Despliegue en Cloud (AWS EC2) — Paridad Total Multi-Réplica

La solución se encuentra desplegada y operativa en una máquina virtual Linux en AWS bajo una arquitectura multi-réplica idéntica a la local:

- **URL Pública (Acceso directo):** [http://3.17.23.16](http://3.17.23.16)
- **Infraestructura:** AWS EC2 `t3.micro` (Ubuntu 24.04 LTS, región Ohio `us-east-2`, Security Group `opsboard-sg` con puertos 22 y 80).
- **Topología en la Nube:** 8 contenedores orquestados con Docker Compose (`docker-compose.cloud.yml`):
  - 1 Proxy perimetral Nginx con Round-Robin y conmutación automática ante caídas.
  - 3 Réplicas Web (`opsboard-cloud-web-1`, `2`, `3`) consumiendo `ghcr.io/frandschz/opsboard-web:latest`.
  - 3 Réplicas API (`opsboard-cloud-api-1`, `2`, `3`) consumiendo `ghcr.io/frandschz/opsboard-api:latest`.
  - 1 Instancia Redis 7 Alpine persistente (`redis-cloud-data`).
- **Verificación de Balanceo Round-Robin en Cloud:**
  ```bash
  for i in {1..6}; do curl -s http://3.17.23.16/health; echo ""; done
  ```
  *(Se observa alternancia entre `api-cloud-1`, `api-cloud-2` y `api-cloud-3`)*.
- **Endpoints de Diagnóstico y Salud:**
  - Frontend SPA: [http://3.17.23.16/](http://3.17.23.16/)
  - Healthcheck API: [http://3.17.23.16/health](http://3.17.23.16/health)
  - Readiness (Redis ping): [http://3.17.23.16/ready](http://3.17.23.16/ready)
  - Flota de réplicas API: [http://3.17.23.16/api/instances](http://3.17.23.16/api/instances)
  - Identidad Web: [http://3.17.23.16/instance.json](http://3.17.23.16/instance.json)
  - API REST Incidentes: [http://3.17.23.16/api/incidents](http://3.17.23.16/api/incidents)
- Para más detalles sobre el aprovisionamiento, firewall y runbook operativo, ver [docs/cloud-deployment.md](docs/cloud-deployment.md).

## Colaboracion

Cada cambio comienza con un Issue, se implementa en una rama corta y entra a `main` mediante Pull Request con al menos una revision. El detalle esta en [CONTRIBUTING.md](CONTRIBUTING.md).


## Documentacion

- [Arquitectura del sistema](docs/architecture.md)
- [Decisiones del proyecto](docs/decisions.md)
- [Roadmap de entregas](docs/roadmap.md)
- [Estrategia y casos de pruebas unitarias](docs/tests.md)
- [Estrategia de seguridad, SAST y SCA](docs/security.md)
- [Publicacion y uso de imagenes en GHCR](docs/registry.md)
- [Procedimiento de despliegue en Cloud (AWS EC2)](docs/cloud-deployment.md)
- [Cheatsheet de consultas y operaciones en Redis](docs/cheatsheet-redis.md)
- [Informe tecnico de entrega](docs/report.md)

