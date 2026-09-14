# Procedimiento y Evidencias de Despliegue en Cloud (Issue #12)

Este documento detalla la arquitectura, el aprovisionamiento, la puesta en producción y la verificación en vivo de **OpsBoard** en una máquina virtual Linux en **Amazon Web Services (AWS EC2)**.

> ✅ **Estado de cumplimiento: 100% COMPLETADO Y VERIFICADO EN VIVO EN AWS EC2**  
> - **URL Pública del Servicio:** [http://3.17.23.16](http://3.17.23.16)  
> - **Proveedor de Infraestructura:** Amazon Web Services (AWS Free Tier / Protected trial, región `us-east-2` Ohio).  
> - **Instancia EC2:** `t3.micro` (vCPU: 2, Memoria: 1 GiB), SO: Ubuntu 24.04 LTS (`ami-0ea3c35c5c3284d82`), ID: `i-03fbc5791843949dd`.  
> - **Inmutabilidad y Registry:** Despliegue orquestado mediante Docker Compose consumiendo imágenes oficiales publicadas en GitHub Container Registry:
>   - `ghcr.io/frandschz/opsboard-web:latest`
>   - `ghcr.io/frandschz/opsboard-api:latest`
> - **Seguridad Perimetral:** Security Group `opsboard-sg` permitiendo únicamente tráfico entrante en puertos `22` (SSH) y `80` (HTTP). Puertos `3000` (API interna) y `6379` (Redis) estrictamente bloqueados desde internet.

---

## 1. Arquitectura de Producción en Cloud

El entorno cloud reproduce la topología desacoplada de OpsBoard mediante Nginx como reverse proxy perimetral y punto único de entrada:

```mermaid
flowchart TD
    Internet["Internet / Clientes Públicos"] -- "HTTP :80" --> SG["AWS Security Group: opsboard-sg<br>(Inbound: TCP 80 & 22 | Bloqueados: 3000 & 6379)"]

    subgraph AWS["Instancia AWS EC2 (t3.micro - Ubuntu 24.04 LTS | IP: 3.17.23.16)"]
        SG --> C_NGINX["opsboard-cloud-nginx<br>(Nginx Alpine :80)"]

        subgraph DockerCloudFront["Red Docker: cloud-frontend"]
            C_WEB["opsboard-cloud-web (:80)<br>Imagen: ghcr.io/.../opsboard-web:latest"]
        end

        subgraph DockerCloudBack["Red Docker: cloud-backend (Aislada de Internet)"]
            C_API["opsboard-cloud-api (:3000)<br>Imagen: ghcr.io/.../opsboard-api:latest"]
            C_REDIS[("opsboard-cloud-redis (:6379)<br>Redis 7 Alpine")]
            C_VOL[("Volumen Persistente<br>redis-cloud-data -> /data")]
            
            C_API -- "TCP :6379" --> C_REDIS
            C_REDIS --- C_VOL
        end

        C_NGINX -- "Path / (Activos SPA y /instance.json)" --> C_WEB
        C_NGINX -- "Path /api/*, /health, /ready, /whoami" --> C_API
    end

    subgraph GHCR["GitHub Container Registry (Inmutable)"]
        GHCR_WEB[("ghcr.io/frandschz/opsboard-web:latest")]
        GHCR_API[("ghcr.io/frandschz/opsboard-api:latest")]
    end

    GHCR_WEB -.->|"docker compose pull"| C_WEB
    GHCR_API -.->|"docker compose pull"| C_API
```

### Características de Producción
* **Punto único de acceso y Same-Origin Policy (Zero CORS):** Nginx expone el puerto estándar HTTP 80. Las solicitudes estáticas de la aplicación web y las peticiones REST (`/api/`) comparten el mismo host y puerto perimetral, impidiendo incidencias por CORS.
* **Inmutabilidad Absoluta:** La máquina virtual en AWS **no compila código ni tiene Node.js o npm instalados**. Consume directamente las imágenes empaquetadas y verificadas por el pipeline de GitHub Actions.
* **Persistencia y Recuperabilidad:** Los incidentes se persisten en Redis con el modo `appendonly yes` montado sobre un volumen Docker independiente (`redis-cloud-data`).

---

## 2. Parámetros de la Instancia en AWS

| Parámetro | Valor de Configuración | Justificación / Rol |
| :--- | :--- | :--- |
| **Instancia EC2** | `t3.micro` (1 GiB RAM, 2 vCPUs) | Dentro del Free Tier de AWS (\$0.00 costo), suficiente para el stack Docker. |
| **Sistema Operativo** | Ubuntu 24.04 LTS (Noble Numbat) | Soporte a largo plazo, kernel moderno y compatibilidad nativa con Docker Engine v29+. |
| **Región de AWS** | `us-east-2` (Ohio) | Baja latencia, alta disponibilidad y soporte completo de VPC. |
| **Dirección IPv4 Pública** | `3.17.23.16` | Acceso directo para clientes y evaluación del coloquio. |
| **DNS Público** | `ec2-3-17-23-16.us-east-2.compute.amazonaws.com` | Hostname provisto por AWS. |
| **Security Group** | `opsboard-sg` | Inbound: `TCP 22` (SSH) y `TCP 80` (HTTP). Outbound: `All traffic`. |
| **Par de Claves SSH** | `opsboard-key.pem` (RSA 2048) | Autenticación criptográfica segura sin contraseñas. |

---

## 3. Procedimiento Paso a Paso de Despliegue Ejecutado

### Paso 1: Configuración de permisos de la clave SSH en Windows
OpenSSH en Windows exige permisos restrictivos (`400` / solo lectura para el usuario actual) para aceptar claves privadas `.pem`:
```powershell
icacls "C:\ruta\opsboard-key.pem" /inheritance:r /grant:r "${env:USERNAME}:(R)"
```

### Paso 2: Conexión SSH a la instancia EC2
```powershell
ssh -i "C:\ruta\opsboard-key.pem" ubuntu@3.17.23.16
```

### Paso 3: Instalación de Docker y Docker Compose v2 en Ubuntu 24.04
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu
```

### Paso 4: Preparación de archivos de orquestación en la VM
En la máquina virtual se crearon los directorios necesarios y se transfirieron los archivos de orquestación mínimos requeridos:
* `infrastructure/compose/docker-compose.cloud.yml`
* `infrastructure/nginx/nginx.cloud.conf`

```bash
mkdir -p ~/opsboard/infrastructure/compose ~/opsboard/infrastructure/nginx
```

### Paso 5: Descarga inmutable desde GHCR e inicio del stack
```bash
cd ~/opsboard
docker compose -f infrastructure/compose/docker-compose.cloud.yml pull
docker compose -f infrastructure/compose/docker-compose.cloud.yml up -d
```

### Paso 6: Verificación de contenedores activos
```bash
docker compose -f infrastructure/compose/docker-compose.cloud.yml ps
```
*Salida obtenida en vivo:*
```text
NAME                   IMAGE                                     COMMAND                  SERVICE   CREATED         STATUS                   PORTS
opsboard-cloud-api     ghcr.io/frandschz/opsboard-api:latest     "docker-entrypoint.s…"   api       3 minutes ago   Up 3 minutes (healthy)   3000/tcp
opsboard-cloud-nginx   nginx:alpine                              "/docker-entrypoint.…"   nginx     3 minutes ago   Up 3 minutes             0.0.0.0:80->80/tcp
opsboard-cloud-redis   redis:7-alpine                            "docker-entrypoint.s…"   redis     3 minutes ago   Up 3 minutes (healthy)   6379/tcp
opsboard-cloud-web     ghcr.io/frandschz/opsboard-web:latest     "/docker-entrypoint.…"   web       3 minutes ago   Up 3 minutes (healthy)   80/tcp
```

---

## 4. Evidencias de Verificación en Vivo (Resultados Reales)

Todas las pruebas se ejecutaron exitosamente contra la IP pública `3.17.23.16`:

### 4.1. Diagnóstico de Salud de la API (`/health`)
```bash
curl -i http://3.17.23.16/health
```
*Respuesta HTTP:*
```http
HTTP/1.1 200 OK
Server: nginx/1.29.1
Date: Mon, 14 Sep 2026 03:20:00 GMT
Content-Type: application/json; charset=utf-8
Content-Length: 39
Connection: keep-alive
X-Instance-ID: api-cloud-1

{"status":"ok","instance":"api-cloud-1"}
```

### 4.2. Diagnóstico de Conexión a Redis (`/ready`)
```bash
curl -i http://3.17.23.16/ready
```
*Respuesta HTTP:*
```http
HTTP/1.1 200 OK
Server: nginx/1.29.1
Date: Mon, 14 Sep 2026 03:20:05 GMT
Content-Type: application/json; charset=utf-8
Content-Length: 39
Connection: keep-alive
X-Instance-ID: api-cloud-1

{"status":"ok","instance":"api-cloud-1"}
```

### 4.3. Identidad del Contenedor Frontend (`/instance.json`)
```bash
curl -i http://3.17.23.16/instance.json
```
*Respuesta HTTP:*
```http
HTTP/1.1 200 OK
Server: nginx/1.29.1
Content-Type: application/json
X-Instance-ID: web-cloud-1

{"instance":"web-cloud-1"}
```

### 4.4. Operación CRUD y Persistencia en Redis
Se registró un incidente real de prueba en la nube y se validó su persistencia en el motor Redis ejecutando `redis-cli` dentro del contenedor:

```bash
docker exec -it opsboard-cloud-redis redis-cli SMEMBERS incidents
# Salida: 1) "1f480ad2-ffeb-44c1-90a6-c87d6bbff08b"

docker exec -it opsboard-cloud-redis redis-cli HGETALL incident:1f480ad2-ffeb-44c1-90a6-c87d6bbff08b
# Salida:
# 1) "id"           2) "1f480ad2-ffeb-44c1-90a6-c87d6bbff08b"
# 3) "title"        4) "Caida de gateway de pagos"
# 5) "service"      6) "checkout-api"
# 7) "severity"     8) "critical"
# 9) "status"      10) "open"
# 11) "createdAt"  12) "2026-09-14T03:30:12.105Z"
# 13) "updatedAt"  14) "2026-09-14T03:30:12.105Z"
```

---

## 5. Procedimiento de Actualización Continua (Rollout)

Cuando se fusiona un nuevo cambio en `main` y el pipeline de GitHub Actions publica nuevas versiones de las imágenes en GHCR:

```bash
cd ~/opsboard

# 1. Descargar las imágenes actualizadas desde GHCR
docker compose -f infrastructure/compose/docker-compose.cloud.yml pull

# 2. Recrear los contenedores actualizados con mínimo downtime
docker compose -f infrastructure/compose/docker-compose.cloud.yml up -d --remove-orphans

# 3. Validar estado y salud de los servicios
docker compose -f infrastructure/compose/docker-compose.cloud.yml ps
```

---

## 6. Procedimiento de Rollback de Emergencia

En caso de que una nueva versión presente anomalías:

```bash
# 1. Fijar en docker-compose.cloud.yml el tag del SHA previo o versión semántica estable:
# image: ghcr.io/frandschz/opsboard-api:sha-cff8353

# 2. Desplegar la versión previa inmediatamente:
docker compose -f infrastructure/compose/docker-compose.cloud.yml up -d
```

