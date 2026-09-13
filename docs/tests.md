# Estrategia y Casos de Pruebas Unitarias (Issue #5)

Este documento describe la arquitectura de pruebas, los casos cubiertos y la metodología de ejecución automatizada sin dependencias de infraestructura externa.

## 1. Comando Único de Ejecución

El monorepo cuenta con un comando unificado en la raíz para ejecutar la suite completa de pruebas unitarias en todos los paquetes (`apps/api` y `apps/web`):

```bash
npm test
```

Asimismo, se dispone de verificación estática de tipos previa a los tests:

```bash
npm run typecheck
```

---

## 2. Pruebas Unitarias del Backend (`apps/api`)

Las pruebas se ejecutan con **Vitest** en aislamiento total, desacopladas de instancias reales de Redis mediante dobles de prueba (mocks en memoria e inyección directa de Fastify).

### 2.1. Pruebas de Endpoints y Validaciones de Entrada (`src/routes/incidents.test.ts`)

| Módulo / Endpoint | Caso de Prueba | Comportamiento Esperado |
| :--- | :--- | :--- |
| `GET /health` | Diagnóstico de salud | Responde HTTP 200 con `{ status: "ok", instance: "<id>" }`. |
| `GET /whoami` | Identificación de instancia | Responde HTTP 200 con `{ instance: "<id>" }`. |
| *General* | Inyección de encabezados | Inyecta el encabezado `X-Instance-ID` en todas las respuestas. |
| `GET /api/incidents` | Listado general | Responde HTTP 200 con el array de incidentes almacenados. |
| `GET /api/incidents/:id` | Consulta por ID existente | Responde HTTP 200 con el incidente correspondiente. |
| `GET /api/incidents/:id` | Consulta por ID inexistente | Responde HTTP 404 con `{ error: "Incidente no encontrado" }`. |
| `POST /api/incidents` | Creación exitosa | Valida payload y responde HTTP 201 con el incidente creado y estado inicial `open`. |
| `POST /api/incidents` | Campos requeridos faltantes | Responde HTTP 400 cuando falta `title`, `service` o `severity`. |
| `POST /api/incidents` | Severidad inválida | Responde HTTP 400 cuando `severity` no pertenece a `['low', 'medium', 'high', 'critical']`. |
| `PATCH /api/incidents/:id` | Actualización de estado | Responde HTTP 200 y actualiza campos permitidos. |
| `PATCH /api/incidents/:id` | Estado inválido | Responde HTTP 400 cuando `status` no pertenece a `['open', 'in_progress', 'resolved', 'closed']`. |
| `PATCH /api/incidents/:id` | Severidad inválida | Responde HTTP 400 ante severidad desconocida en actualización. |
| `PATCH /api/incidents/:id` | Actualización inexistente | Responde HTTP 404 si el incidente no existe. |
| `DELETE /api/incidents/:id` | Eliminación exitosa | Responde HTTP 204 sin contenido. |
| `DELETE /api/incidents/:id` | Eliminación inexistente | Responde HTTP 404 si el incidente no existe. |

### 2.2. Pruebas de Store y Lógica de Negocio (`src/store/incidents.test.ts`)
* **Creación:** Inicialización correcta de UUID, timestamps ISO y estado `open`.
* **Listado e Índices:** Verificación de atomicidad mediante operaciones Redis pipeline (`HSET` + `SADD`).
* **Consulta unívoca:** Recuperación de Hash por clave de incidente.
* **Actualización atómica:** Actualización granular de campos sin sobreescribir datos existentes y avance de `updatedAt`.
* **Eliminación y Limpieza de Índice:** Remoción simultánea de la clave `incident:<id>` y de la pertenencia en el Set `incidents`.

### 2.3. Pruebas de Readiness (`src/ready.test.ts`)
* **Dependencia Saludable:** Responde HTTP 200 cuando el mock de Redis responde `PONG`.
* **Fallo de Dependencia:** Responde HTTP 503 cuando la conexión a Redis falla.

---

## 3. Pruebas Unitarias del Frontend (`apps/web`)

Implementadas mediante **Vitest** + **React Testing Library** + **jsdom** en `apps/web/src/App.test.tsx`:

1. **Carga y Resumen:** Renderizado inicial, estado de carga (`Cargando incidentes`), consumo de `/api/incidents` y actualización del contador de métricas.
2. **Estado Vacío:** Visualización adecuada del mensaje cuando no hay incidentes registrados.
3. **Flujo de Creación:** Interacción con el formulario (título, servicio, severidad), envío mediante POST `/api/incidents` y renderizado reactivo del nuevo incidente en la lista.
4. **Transición de Estados:** Avance de ciclo de vida del incidente mediante PATCH `/api/incidents/:id` al presionar "Mover a En progreso".
5. **Eliminación:** Borrado de incidente mediante DELETE `/api/incidents/:id` y remoción inmediata del DOM.
6. **Manejo de Errores y Resiliencia:** Visualización de mensajes de error de backend (ej. Redis no disponible HTTP 503) y reintento exitoso con el botón "Reintentar".
7. **Trazabilidad de Réplicas (Badge):** Consulta asincrónica a `/instance.json` y `/health` para mostrar el nodo Web y API que atendieron la solicitud.
