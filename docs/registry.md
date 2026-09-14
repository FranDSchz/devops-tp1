# Guía de Publicación y Uso de Imágenes en GHCR (Issue #11)

Este documento detalla el esquema de imágenes contenerizadas publicadas en GitHub Container Registry (GHCR), su trazabilidad y el procedimiento operativo para su descarga y ejecución.

---

## 1. Artefactos Publicados en GHCR

El pipeline de entrega continua (`.github/workflows/release-ghcr.yml`) construye y publica automáticamente imágenes inmutables multi-stage en el registro de paquetes de GitHub:

| Componente | Imagen en Registry | Propósito | Puerto Expuesto |
| :--- | :--- | :--- | :---: |
| **API REST** | `ghcr.io/frandschz/opsboard-api` | Servicio backend Fastify + persistencia Redis | `3000` |
| **Web SPA** | `ghcr.io/frandschz/opsboard-web` | Frontend React empaquetado en Nginx alpine | `80` |

---

## 2. Esquema de Versionado y Trazabilidad

Para garantizar reproducibilidad y auditoría conforme a las buenas prácticas de DevOps:

1. **Tag `latest`:** Apunta siempre al último build generado desde la rama `main`.
2. **Tag de Commit SHA (`sha-<hash>`):** Permite fijar y rastrear la versión exacta del código fuente que originó la imagen (por ejemplo, `sha-10b9e12`).
3. **Tags de versión semántica (Release):** Al crear un tag de Git (ej. `v1.0.0`), se genera automáticamente una etiqueta inmutable homónima en GHCR.

---

## 3. Procedimiento de Descarga y Ejecución

### 3.1. Descarga Directa (Docker CLI)

Las imágenes son públicas y no requieren credenciales privadas para su descarga en entornos de desarrollo o servidores:

```bash
# Descargar imágenes
docker pull ghcr.io/frandschz/opsboard-api:latest
docker pull ghcr.io/frandschz/opsboard-web:latest
```

### 3.2. Ejecución Local Individual

Para ejecutar la API conectada a un Redis local:

```bash
docker run -d \
  --name opsboard-api \
  -p 3000:3000 \
  -e REDIS_HOST=host.docker.internal \
  -e PORT=3000 \
  ghcr.io/frandschz/opsboard-api:latest
```

Para ejecutar la aplicación Web:

```bash
docker run -d \
  --name opsboard-web \
  -p 80:80 \
  -e INSTANCE_ID=web-standalone \
  ghcr.io/frandschz/opsboard-web:latest
```

### 3.3. Despliegue en Stack Cloud (Docker Compose)

El stack de producción definido en `infrastructure/compose/docker-compose.cloud.yml` orquesta los contenedores oficiales desde GHCR junto con Redis y Nginx reverse proxy:

```bash
# Navegar al directorio de compose
cd infrastructure/compose

# Descargar las versiones más recientes desde GHCR
docker compose -f docker-compose.cloud.yml pull

# Iniciar la arquitectura en modo detached
docker compose -f docker-compose.cloud.yml up -d
```
