# Registro de decisiones

Este documento registra las decisiones vigentes. Debe actualizarse cuando el equipo cambie una decision relevante.

## D-001 - Aplicacion

**Decision:** desarrollar OpsBoard, un tablero sencillo de incidentes.

**Motivo:** tiene una complejidad similar a una ToDo, pero permite presentar un caso relacionado con DevOps y demostrar claramente estado compartido, replicas y balanceo.

## D-002 - Monorepo

**Decision:** mantener frontend, API, infraestructura y documentacion en un unico repositorio.

**Motivo:** simplifica la coordinacion del equipo, los Pull Requests y los workflows del TP.

## D-003 - Stack

**Decision:** React + Vite + TypeScript para web y Fastify + TypeScript para API.

**Motivo:** utilizar un lenguaje comun reduce friccion y permite compartir herramientas de build, testing y analisis.

## D-004 - Almacenamiento

**Decision:** utilizar Redis mediante un contenedor oficial.

**Motivo:** es la alternativa mas alineada con la consigna. Todas las replicas compartiran el mismo estado y solamente la API tendra acceso directo.

## D-005 - Proxy y replicas

**Decision:** Nginx con tres nodos web y tres nodos API en el entorno local.

**Motivo:** cubre la interpretacion mas conservadora del requisito de tres nodos y permite demostrar balanceo y tolerancia a fallos.

## D-006 - Seguridad

**Decision:** CodeQL para SAST y Trivy para SCA y Secrets.

**Motivo:** ambas herramientas son adecuadas para un repositorio publico, se integran con GitHub Actions y cubren la aclaracion realizada en clase sin requerir una plataforma paga.

## D-007 - Registry

**Decision:** publicar las imagenes propias de web y API en GHCR.

**Motivo:** integracion directa con GitHub Actions y el repositorio del proyecto.

## D-008 - Cloud

**Decision:** evaluar Render como primera opcion mediante una prueba temprana.

**Motivo:** permite desplegar imagenes preconstruidas. La decision se revisara si Redis, costos o restricciones operativas impiden cumplir la consigna.

## D-009 - Flujo de colaboracion

**Decision:** GitHub Flow con `main`, ramas cortas, Issues y Pull Requests; no utilizar `develop`.

**Motivo:** es suficiente para cinco integrantes y mantiene visible el aporte y la revision de cada cambio.

