# Procedimiento de Despliegue en Cloud (Issue #12)

Este documento detalla la arquitectura, el procedimiento de aprovisionamiento, despliegue y actualización continua de OpsBoard en un entorno de máquina virtual Cloud (IaaS).

> ⚠️ **Estado de cumplimiento:**
> - **Preparación técnica:** COMPLETADA Y VALIDADA (`docker-compose.cloud.yml` y `nginx.cloud.conf` verificados).
> - **Despliegue real:** BLOQUEADO / PENDIENTE de imágenes en GHCR (Issue #11 asignada a Lautaro) y de aprovisionamiento de VM.
> - La Issue #12 **NO** se considerará cumplida hasta desplegar efectivamente consumiendo las imágenes remotas desde el Registry y comprobar la URL pública. Un despliegue local o construido desde código sólo tiene fines de diagnóstico.

---

## 1. Arquitectura de Producción en Cloud

El entorno cloud reproduce la topología desacoplada mediante Nginx como punto de entrada único:

```text
Internet / Cliente
        |
   Puerto 80/443 (HTTP/S)
        v
+-----------------------+
| opsboard-cloud-nginx  |
+-----------------------+
     |             |
  (Frontend)    (Backend)
     |             |
     v             v
+----------+  +-------------------+
| web:80   |  | api:3000          |
+----------+  +-------------------+
                   |
                (Backend)
                   v
              +-------------------+
              | redis:6379        |
              | (Volumen datos)   |
              +-------------------+
```

### Características Principales
* **Punto único de acceso:** Nginx expone el puerto 80 (y 443 con TLS), enrutando:
  * `/` y `/assets/` hacia `web` (React SPA).
  * `/api/`, `/health`, `/ready` y `/whoami` hacia `api` (Fastify API).
  * Inyecta y retransmite `X-Instance-ID` y soporta failover con `proxy_next_upstream`.
* **Zero CORS:** Al servirse bajo el mismo origen (`host:80`), no existe fricción de políticas CORS.
* **Inmutabilidad y Consumo de Registry:** La VM **no compila código ni requiere Node.js instalado**. Consume exclusivamente:
  * `ghcr.io/frandschz/opsboard-web:latest` (o tag de release/SHA).
  * `ghcr.io/frandschz/opsboard-api:latest` (o tag de release/SHA).
  * `redis:7-alpine` (imagen oficial con persistencia appendonly).
  * `nginx:alpine` (imagen oficial con `nginx.cloud.conf`).

---

## 2. Requisitos Previos en el Proveedor Cloud

La solución es agnóstica del proveedor IaaS (AWS EC2 `t2.micro` / `t3.micro`, Oracle Cloud Always Free `VM.Standard.A1.Flex` / `E2.1.Micro`, Azure B1s o Google Cloud `e2-micro`).

### Configuración de Red y Seguridad (Firewall / Security Group)
Abrir los siguientes puertos en la interfaz pública:
* `TCP 22`: SSH (gestión y despliegue).
* `TCP 80`: HTTP (tráfico web y API de OpsBoard).
* `TCP 443`: HTTPS (opcional, en caso de agregar Let's Encrypt).
* **Bloquear** explícitamente los puertos `3000` y `6379` en la interfaz pública.

---

## 3. Procedimiento de Aprovisionamiento e Instalación (Paso a Paso)

### Paso 1: Conexión SSH a la instancia
```bash
ssh -i /ruta/a/tu-clave.pem usuario@<IP_PUBLICA_VM>
```

### Paso 2: Instalación de Docker y Docker Compose v2 (Ubuntu 24.04 LTS)
```bash
# Actualizar repositorios del sistema
sudo apt-get update && sudo apt-get upgrade -y

# Instalar dependencias previas
sudo apt-get install -y ca-certificates curl gnupg

# Agregar clave GPG oficial de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Agregar repositorio de Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine y Docker Compose Plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Agregar usuario al grupo docker (para ejecutar sin sudo)
sudo usermod -aG docker $USER
newgrp docker
```

---

## 4. Despliegue de la Aplicación

### Paso 1: Estructurar el directorio de despliegue en la VM
En la máquina virtual, clonar el repositorio o copiar únicamente los archivos de infraestructura:
```bash
mkdir -p ~/opsboard/infrastructure/compose
mkdir -p ~/opsboard/infrastructure/nginx
cd ~/opsboard
```

Copiar los archivos:
* `infrastructure/compose/docker-compose.cloud.yml`
* `infrastructure/nginx/nginx.cloud.conf`

*(Alternativamente, clonar la rama `infra/cloud-deployment` directamente:)*
```bash
git clone -b infra/cloud-deployment https://github.com/FranDSchz/devops-tp1.git opsboard
cd opsboard
```

### Paso 2: Autenticación en GHCR (si las imágenes son privadas)
Si las imágenes en GHCR no son públicas, autenticarse con un Personal Access Token (PAT) con permiso `read:packages`:
```bash
echo "<TU_GITHUB_TOKEN>" | docker login ghcr.io -u <USUARIO_GITHUB> --password-stdin
```
*(Si los paquetes fueron configurados como públicos en GitHub Packages, el pull se realiza sin autenticación).*

### Paso 3: Descarga de imágenes y puesta en marcha
```bash
# Descargar las imágenes publicadas desde el Registry
docker compose -f infrastructure/compose/docker-compose.cloud.yml pull

# Levantar el stack completo en segundo plano
docker compose -f infrastructure/compose/docker-compose.cloud.yml up -d

# Verificar que los 4 contenedores estén corriendo y saludables
docker compose -f infrastructure/compose/docker-compose.cloud.yml ps
```

---

## 5. Verificación del Despliegue en Cloud

Ejecutar las comprobaciones desde una máquina externa:

```bash
# 1. Comprobar endpoint de salud de la API vía Nginx
curl -i http://<IP_PUBLICA_VM>/health
# Salida esperada: HTTP/1.1 200 OK, {"status":"ok","instance":"api-cloud-1"}

# 2. Comprobar readiness con Redis conectado
curl -i http://<IP_PUBLICA_VM>/ready
# Salida esperada: HTTP/1.1 200 OK, {"status":"ok","instance":"api-cloud-1"}

# 3. Comprobar identidad del servicio web
curl -i http://<IP_PUBLICA_VM>/instance.json
# Salida esperada: HTTP/1.1 200 OK, {"instance":"web-cloud-1"}

# 4. Comprobar interfaz web en navegador
# Abrir: http://<IP_PUBLICA_VM>/
# Verificar: Creación, listado y actualización de incidentes.
```

---

## 6. Procedimiento de Actualización Continua (Rollout)

Cuando Lautaro publique una nueva versión de imágenes en GHCR (por ejemplo ante un cambio en `main`):

```bash
cd ~/opsboard
# 1. Descargar la nueva versión
docker compose -f infrastructure/compose/docker-compose.cloud.yml pull

# 2. Recrear únicamente los contenedores actualizados con mínimo downtime
docker compose -f infrastructure/compose/docker-compose.cloud.yml up -d --remove-orphans

# 3. Validar logs y salud
docker compose -f infrastructure/compose/docker-compose.cloud.yml logs --tail=50 api
docker compose -f infrastructure/compose/docker-compose.cloud.yml ps
```
