# Frontend de OpsBoard

Aplicación web de React, Vite y TypeScript para gestionar los incidentes expuestos por la API REST de OpsBoard.

## Funciones

- Listar incidentes almacenados por el backend en Redis.
- Crear incidentes con título, servicio y severidad.
- Avanzar un incidente por los estados `open`, `in_progress`, `resolved` y `closed`.
- Eliminar incidentes.
- Mostrar estados de carga, errores de la API y un resumen del tablero.

El navegador nunca accede a Redis: todas las operaciones usan la API.

## Desarrollo local

Desde la raíz del repositorio:

```bash
npm ci
npm run dev:api
npm run dev:web
```

Vite sirve la web en `http://localhost:5173` y redirige las solicitudes `/api` a `http://localhost:3000`.

## Configuración de la API

La aplicación usa `/api` por defecto para conservar el mismo origen detrás del reverse proxy. Si se necesita otra dirección durante el build, se puede definir `VITE_API_BASE_URL`:

```bash
VITE_API_BASE_URL=http://localhost:3000/api npm run build -w apps/web
```

También se admite como argumento al construir la imagen:

```bash
docker build \
  --build-arg VITE_API_BASE_URL=/api \
  -f apps/web/Dockerfile \
  -t opsboard-web .
```

## Verificación

```bash
npm run typecheck -w apps/web
npm run test -w apps/web
npm run build -w apps/web
```

La imagen final sirve los archivos estáticos con Nginx, incluye fallback para rutas de SPA y expone `GET /health` para comprobar la salud del contenedor.
