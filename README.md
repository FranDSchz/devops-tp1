# OpsBoard

Trabajo Practico 1 de DevOps - UTN FRRe 2026.

OpsBoard sera una aplicacion web sencilla para registrar y gestionar incidentes de servicios. El objetivo principal del proyecto no es construir un producto complejo, sino demostrar un flujo DevOps completo con contenedores, replicas, balanceo, CI, seguridad, publicacion de imagenes y despliegue en la nube.

## Estado

El proyecto se encuentra en la **Fase 0: inicializacion organizativa**. Todavia no contiene codigo de aplicacion ni infraestructura ejecutable.

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

Requisito: Docker y Docker Compose instalados.

```bash
# Desde la raiz del repositorio
cd infrastructure/compose
docker compose up --build
```

La aplicacion queda disponible en <http://localhost:8080>.

- Nginx expone el unico puerto de entrada (`8080`) y balancea entre 3 nodos web y 3 nodos API.
- Redis se ejecuta en su propio contenedor con un volumen persistente.
- Cada nodo API responde el header `X-Instance-ID` y el endpoint `/health` devuelve la instancia que lo atendio (permite demostrar el balanceo).

Para detener el stack: `docker compose down` (agregar `-v` para borrar tambien el volumen de Redis).

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

## Entregables previstos

- Aplicacion funcionando durante el coloquio.
- Repositorio grupal publico.
- Imagenes publicadas en GHCR mediante GitHub Actions.
- Aplicacion desplegada en un servicio cloud desde el Registry.
- Informe o presentacion con resultados, dificultades y mejoras futuras.
- Demostracion de Redis, balanceo y tolerancia a la caida de una instancia.

