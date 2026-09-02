# Roadmap

El roadmap organiza resultados, no asignaciones personales. Los responsables y revisores se definiran en los Issues.

## M0 - Organizacion

- Inicializar documentacion y plantillas.
- Proteger `main`.
- Crear Project, etiquetas e Issues iniciales.
- Incorporar a todos los colaboradores.

## M1 - Aplicacion base

- Definir contrato de API y modelo de incidente.
- Inicializar el monorepo y las herramientas del stack.
- Implementar el MVP de API con Redis.
- Implementar el MVP web.
- Agregar tests unitarios significativos.

## M2 - Contenedores y resiliencia local

- Contenerizar web, API y Redis.
- Integrar servicios con Docker Compose.
- Incorporar Nginx como reverse proxy.
- Ejecutar tres replicas web y tres API.
- Demostrar balanceo y tolerancia a fallos.
- Documentar la inspeccion de datos en Redis.

## M3 - CI, seguridad y Registry

- Crear workflow de CI para typecheck, tests y build.
- Crear workflow de Security con CodeQL y Trivy.
- Agregar badges de CI y Security.
- Construir y publicar las imagenes web y API en GHCR.
- Analizar las imagenes antes de publicarlas.

## M4 - Cloud y entrega

- Ejecutar una prueba de despliegue desde GHCR.
- Completar el despliegue externo.
- Preparar informe o presentacion.
- Crear un guion de demostracion.
- Ensayar el coloquio con todos los integrantes.

## Principio de priorizacion

Primero se completa el recorrido obligatorio de punta a punta. Las mejoras opcionales se consideran solamente cuando todos los criterios de la rubrica tienen una evidencia verificable.

