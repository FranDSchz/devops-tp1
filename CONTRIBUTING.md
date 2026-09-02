# Guia de contribucion

Este repositorio utiliza GitHub Flow. No se utilizara una rama `develop`.

## Flujo de trabajo

1. Elegir o crear un Issue.
2. Acordar su alcance y criterios de aceptacion.
3. Crear una rama desde `main` actualizada.
4. Realizar cambios pequenos y enfocados.
5. Abrir un Pull Request enlazado con el Issue.
6. Solicitar la revision de al menos otro integrante.
7. Resolver comentarios y verificar los checks disponibles.
8. Integrar mediante squash merge.
9. Eliminar la rama una vez integrado el cambio.

## Nombres de ramas

Usar nombres breves y descriptivos:

```text
feature/descripcion
fix/descripcion
infra/descripcion
ci/descripcion
docs/descripcion
```

Ejemplos:

```text
feature/create-incident
infra/nginx-load-balancer
ci/security-scans
docs/update-architecture
```

## Commits

Usar mensajes en ingles, en presente y con un proposito claro. Se recomienda el siguiente formato:

```text
feat: add incident creation endpoint
fix: validate incident severity
infra: add nginx upstream configuration
ci: run unit tests on pull requests
docs: document local architecture
```

Evitar commits que mezclen cambios funcionales, infraestructura y documentacion sin una razon concreta.

## Pull Requests

Cada Pull Request debe:

- Resolver una tarea concreta.
- Enlazar el Issue correspondiente con `Closes #numero` cuando corresponda.
- Explicar que cambia y como fue verificado.
- Mantener fuera del alcance cambios no relacionados.
- No incluir credenciales, tokens ni archivos de entorno con secretos.
- Recibir al menos una aprobacion antes del merge.

Cuando existan los workflows, tambien debera aprobar los checks de CI y Security.

## Definition of Done

Una tarea se considera terminada cuando:

- Cumple sus criterios de aceptacion.
- Incluye pruebas cuando corresponde.
- La documentacion afectada esta actualizada.
- No incorpora secretos ni dependencias vulnerables conocidas.
- Fue revisada mediante Pull Request.
- Los checks automaticos disponibles finalizaron correctamente.

## Responsabilidad compartida

Puede haber responsables principales por area, pero ningun componente debe ser conocido por una sola persona. Quien implementa una tarea no debe ser su unico revisor, y todos los integrantes deben poder explicar el flujo web, proxy, API y Redis.

