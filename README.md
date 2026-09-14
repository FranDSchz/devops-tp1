# OpsBoard

[![CI](https://github.com/FranDSchz/devops-tp1/actions/workflows/ci.yml/badge.svg)](https://github.com/FranDSchz/devops-tp1/actions/workflows/ci.yml)
[![Security](https://github.com/FranDSchz/devops-tp1/actions/workflows/security.yml/badge.svg)](https://github.com/FranDSchz/devops-tp1/actions/workflows/security.yml)
[![GHCR Images](https://github.com/FranDSchz/devops-tp1/actions/workflows/release-ghcr.yml/badge.svg)](https://github.com/FranDSchz/devops-tp1/actions/workflows/release-ghcr.yml)

Trabajo Practico 1 de DevOps - UTN FRRe 2026.

OpsBoard sera una aplicacion web sencilla para registrar y gestionar incidentes de servicios. El objetivo principal del proyecto no es construir un producto complejo, sino demostrar un flujo DevOps completo con contenedores, replicas, balanceo, CI, seguridad, publicacion de imagenes y despliegue en la nube.

## Estado

- **M0**: completado (documentacion, plantillas y organizacion inicial).
- **M1**: completado (aplicacion base: API, web y tests unitarios).
- **M2**: completado (contenedores, Nginx, tres replicas web y tres API, balanceo y tolerancia a fallos).
- **M3**: completado (CI, seguridad CodeQL/Trivy y Registry GHCR).
- **M4**: completado (arquitectura cloud y documentacion consolidada).

La aplicacion es ejecutable: ver [Ejecucion local](#ejecucion-local-docker-compose).

Fecha de entrega indicada en la consigna: **lunes 14 de septiembre de 2026**.

## Alcance funcional minimo

- Crear un incidente.
- Listar los incidentes almacenados.
- Cambiar el estado de un incidente.
- Eliminar un incidente.
- Guardar y recuperar la informacion mediante Redis.

Cada incidente tendra inicialmente:

- Identificador.
- Titulo.
- Servicio afectado.
- Severidad.
- Estado.
- Fecha de creacion.

## Arquitectura propuesta

```text
                         +-- web-1
                         +-- web-2
Usuario -- Nginx --------+-- web-3
             |
             | /api
             +-- api-1 --+
             +-- api-2 --+-- Redis
             +-- api-3 --+
```

La arquitectura completa con proxy y replicas se ejecutara localmente mediante Docker Compose. En cloud se requiere al menos una instancia funcional desplegada desde imagenes publicadas en GHCR.

## Decisiones tecnicas

| Area | Decision |
| --- | --- |
| Frontend | React, Vite y TypeScript |
| API | Fastify y TypeScript |
| Almacenamiento | Redis |
| Reverse proxy | Nginx |
| Orquestacion local | Docker Compose |
| Tests | Vitest |
| SAST | CodeQL |
| SCA y Secrets | Trivy |
| Registry | GitHub Container Registry (GHCR) |
| Cloud inicial | Render, sujeto a una prueba temprana |
| Flujo de trabajo | GitHub Flow, sin rama `develop` |

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
- [Arquitectura propuesta](docs/architecture.md)
- [Decisiones del proyecto](docs/decisions.md)
- [Roadmap](docs/roadmap.md)
- [Estrategia y casos de pruebas unitarias](docs/tests.md)
- [Estrategia de seguridad, SAST y SCA](docs/security.md)
- [Publicacion y uso de imagenes en GHCR](docs/registry.md)
- [Procedimiento de despliegue en Cloud](docs/cloud-deployment.md)
- [Informe tecnico de entrega](docs/report.md)

## Entregables previstos

- Aplicacion funcionando durante el coloquio.
- Repositorio grupal publico.
- Imagenes publicadas en GHCR mediante GitHub Actions.
- Aplicacion desplegada en un servicio cloud desde el Registry.
- Informe o presentacion con resultados, dificultades y mejoras futuras.
- Demostracion de Redis, balanceo y tolerancia a la caida de una instancia.

