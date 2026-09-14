# Roadmap

El roadmap organiza resultados, no asignaciones personales. Los responsables y revisores se definiran en los Issues.

## M0 - Organizacion (Completado)

- [x] Inicializar documentacion y plantillas.
- [x] Proteger `main`.
- [x] Crear Project, etiquetas e Issues iniciales.
- [x] Incorporar a todos los colaboradores.

## M1 - Aplicacion base (Completado)

- [x] Definir contrato de API y modelo de incidente.
- [x] Inicializar el monorepo y las herramientas del stack.
- [x] Implementar el MVP de API con Redis.
- [x] Implementar el MVP web.
- [x] Agregar tests unitarios significativos (Vitest).

## M2 - Contenedores y resiliencia local (Completado)

- [x] Contenerizar web, API y Redis.
- [x] Integrar servicios con Docker Compose.
- [x] Incorporar Nginx como reverse proxy y load balancer.
- [x] Ejecutar tres replicas web y tres API.
- [x] Demostrar balanceo y tolerancia a fallos.
- [x] Documentar la inspeccion de datos en Redis.

## M3 - CI, seguridad y Registry (Completado)

- [x] Crear workflow de CI para typecheck, tests y build.
- [x] Crear workflow de Security con CodeQL y Trivy.
- [x] Agregar badges de CI y Security.
- [x] Construir y publicar las imagenes web y API en GHCR.
- [x] Analizar las imagenes antes de publicarlas.

## M4 - Cloud y entrega (Completado)

- [x] Ejecutar prueba de despliegue desde GHCR.
- [x] Completar el despliegue externo en AWS EC2 (`http://3.17.23.16`).
- [x] Preparar informe tecnico formal (`docs/report.md`).
- [x] Crear un guion de demostracion y machete del coloquio (`docs/guion-coloquio.md`).
- [x] Ensayar el coloquio con todos los integrantes.

## Principio de priorizacion

Primero se completa el recorrido obligatorio de punta a punta. Las mejoras opcionales se consideran solamente cuando todos los criterios de la rubrica tienen una evidencia verificable.

