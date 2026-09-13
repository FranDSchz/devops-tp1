# OpsBoard — Informe Técnico de Arquitectura y Despliegue (TP1)

**Cátedra:** DevOps 2026 | **Institución:** Universidad Tecnológica Nacional — Facultad Regional Resistencia  
**Proyecto:** OpsBoard — Tablero Contenerizado de Gestión de Incidentes  
**Fecha de Entrega:** Septiembre de 2026  
**Repositorio Oficial:** [https://github.com/FranDSchz/devops-tp1](https://github.com/FranDSchz/devops-tp1)

---

## 1. Resumen Ejecutivo

OpsBoard es una solución web contenerizada diseñada para la captura, visualización y gestión del ciclo de vida de incidentes de infraestructura. El objetivo central del proyecto es implementar y validar un flujo DevOps integral: arquitectura desacoplada en microservicios, orquestación mediante contenedores, balanceo de carga con tolerancia a fallos, integración continua, aseguramiento de la calidad y despliegue en la nube a partir de un registro inmutable de imágenes.

### Equipo de Desarrollo y Áreas de Trabajo
* **Celeste Martín Rodich:** Backend, API REST y capa de persistencia en Redis.
* **Philippe:** Frontend SPA en React, gestión de estado y experiencia de usuario.
* **Mariano Insaurralde:** Contenerización, orquestación local con Docker Compose, proxy inverso y resiliencia.
* **Lautaro Robales:** Integración continua, análisis de seguridad (SAST/SCA) y publicación en Container Registry.
* **Franco D. Sánchez:** Despliegue en Cloud desde Registry, arquitectura de producción y consolidación técnica.

---

## 2. Arquitectura del Sistema y Principios de Diseño

El sistema está estructurado bajo un modelo de tres capas contenerizadas, orquestadas mediante Docker Compose y expuestas exclusivamente a través de un proxy inverso unificado.

```text
                                         RED DOCKER: frontend
                                      +-------------------------+
                                 +--> | opsboard-web-1 (React)  |
                                 |    +-------------------------+
                                 +--> | opsboard-web-2 (React)  |
                                 |    +-------------------------+
Cliente / Navegador              +--> | opsboard-web-3 (React)  |
        |                        |    +-------------------------+
        v                        |
+-------------------+            |       RED DOCKER: backend
|  opsboard-nginx   | (Puerto 80)|    +-------------------------+
|  (Reverse Proxy   |------------+--> | opsboard-api-1 (Fastify)| --+
|  & Load Balancer) |            |    +-------------------------+   |
+-------------------+            +--> | opsboard-api-2 (Fastify)| --+--> [ opsboard-redis ]
                                 |    +-------------------------+   |     (Redis 7 Alpine
                                 +--> | opsboard-api-3 (Fastify)| --+     + Volumen Datos)
                                      +-------------------------+
```

### Principios de Ingeniería Aplicados
1. **Punto Único de Entrada y Mismo Origen:** Nginx actúa como fachada perimetral única (puerto `8080` local, `80/443` en la nube). Rutea los activos estáticos (`/`) hacia las instancias web y las peticiones transaccionales (`/api/`) hacia las instancias de API. Esto asegura que el cliente web consuma la API bajo el mismo origen, eliminando la necesidad de habilitar CORS y reduciendo la superficie de exposición.
2. **Aislamiento de Red y Mínimo Privilegio:** Se configuran dos redes virtuales independientes (`frontend` y `backend`). La base de datos Redis reside exclusivamente en la red privada `backend`, sin mapeo de puertos hacia el host exterior y sin comunicación con los nodos web.
3. **Servicios Stateless:** Los nodos de la API no conservan estado en memoria de proceso; cualquier réplica puede atender cualquier solicitud leyendo y escribiendo directamente en la capa de persistencia compartida.
4. **Paridad de Entornos (Dev/Prod):** La arquitectura de red, enrutamiento y puertos se mantiene análoga entre el entorno de desarrollo local y el entorno de producción en la nube.

---

## 3. Resultados Técnicos Obtenidos

### 3.1. Persistencia y Modelado de Datos en Redis
Redis 7 Alpine opera como motor de persistencia estructurada, garantizando durabilidad mediante el modo `appendonly yes` vinculado a un volumen persistente (`redis-data` en local, `redis-cloud-data` en cloud).

* **Modelado de Datos:**
  * **Entidades (`Hash`):** Cada incidente se persiste bajo la clave `incident:<uuid>` conteniendo atributos tipados: `id`, `title`, `service`, `severity`, `status`, `createdAt` y `updatedAt`.
  * **Índice Global (`Set`):** Se utiliza la clave `incidents` de tipo Set para indexar los identificadores únicos, permitiendo consultas de colección eficientes sin recurrir a comandos bloqueantes (`KEYS`).
* **Verificación de Persistencia mediante CLI:**
  ```bash
  # Conexión al contenedor
  docker exec -it opsboard-redis redis-cli

  # Consulta de claves indexadas
  SMEMBERS incidents

  # Inspección de atributos de un incidente
  HGETALL incident:<uuid>

  # Conteo de entidades
  SCARD incidents
  ```

### 3.2. Balanceo de Carga y Tolerancia a Fallos
El balanceador Nginx implementa distribución Round-Robin con detección activa y conmutación automática ante fallos de nodos:

```nginx
upstream api_upstream {
    server api-1:3000 max_fails=1 fail_timeout=10s resolve;
    server api-2:3000 max_fails=1 fail_timeout=10s resolve;
    server api-3:3000 max_fails=1 fail_timeout=10s resolve;
}
```

* **Trazabilidad de Réplicas:** Cada respuesta de la API inyecta el encabezado `X-Instance-ID`, retransmitido al cliente mediante la directiva `proxy_pass_header X-Instance-ID`. Asimismo, el frontend expone su identificador a través de `/instance.json`.
* **Prueba de Resiliencia:** Ante la detención forzada de una instancia (`docker stop opsboard-api-2`), la directiva `proxy_next_upstream error timeout http_502;` redirige la petición en curso hacia un nodo sano en menos de 2 segundos. La aplicación web y las pruebas concurrentes registran 100% de respuestas exitosas (código HTTP 200), sin interrupción de servicio para el usuario final.

### 3.3. Integración Continua y Calidad de Código
* **Verificación Estática:** Comprobación estricta de tipos mediante TypeScript (`tsc --noEmit`), reportando 0 errores en los paquetes `apps/api` y `apps/web`.
* **Pruebas Unitarias:** Suite implementada con Vitest:
  * Frontend: 7 pruebas unitarias aprobadas que validan renderizado reactivo, carga asincrónica y manejo de estados.
  * Backend: Pruebas de contrato y endpoints (`/ready`, `/health`, store con mocks de Redis).
* **Pipeline Planificado (GitHub Actions):** Automatización que integra instalación determinista (`npm ci`), ejecución de pruebas, análisis de seguridad estático (SAST) y escaneo de vulnerabilidades/secretos (Trivy), publicando badges de estado en la raíz del proyecto.

### 3.4. Despliegue en Cloud desde el Registry
* **Estrategia IaaS:** Despliegue en una máquina virtual Linux (Ubuntu 24.04) mediante Docker Compose. Se optó por una instancia IaaS con IP pública fija frente a plataformas PaaS gratuitas para evitar demoras por suspensión por inactividad (*cold starts* de 50 a 90 segundos) y garantizar disponibilidad continua.
* **Inmutabilidad de Artefactos:** La máquina virtual en producción no compila código fuente ni posee dependencias de desarrollo; consume directamente los artefactos preconstruidos y versionados en GitHub Container Registry:
  * `ghcr.io/frandschz/opsboard-web:latest`
  * `ghcr.io/frandschz/opsboard-api:latest`
* **Verificación Operativa:** Procedimiento estandarizado y documentado en `docs/cloud-deployment.md` para aprovisionamiento, verificación de health checks (`/health`, `/ready`) y actualizaciones con mínimo tiempo de inactividad (`rollout`).

---

## 4. Dificultades Técnicas Encontradas y Soluciones Aplicadas

1. **Gestión de Monorepo en Builds de Docker:**
   * *Desafío:* Resolver dependencias cruzadas entre paquetes de npm workspaces (`package.json` raíz y `tsconfig.base.json`) sin invalidar la caché de capas de Docker ante cambios menores de código.
   * *Solución:* Implementación de Dockerfiles multi-stage con contexto en la raíz del repositorio, aislando la fase de resolución de dependencias (`npm ci --workspace=...`) de la fase de compilación y empaquetado para producción.
2. **Sensibilidad de Tiempos en Tests Asincrónicos:**
   * *Desafío:* En pruebas concurrentes del store de incidentes (`incidents.test.ts`), operaciones consecutivas de creación y actualización pueden ejecutarse dentro del mismo milisegundo, provocando que `createdAt` y `updatedAt` coincidan exactamente.
   * *Solución:* Identificación del comportamiento y propuesta de flexibilización de aserciones hacia consistencia temporal lógica (`updatedAt >= createdAt`).
3. **Resolución Dinámica de Nombres en Nginx:**
   * *Desafío:* En entornos multicontenedor, cuando un contenedor se reinicia puede adquirir una nueva dirección IP interna en la red de Docker, provocando errores de resolución en Nginx si los upstream están cacheados estáticamente.
   * *Solución:* Configuración de la directiva `resolver 127.0.0.11 valid=10s ipv6=off;` junto con el parámetro `resolve` en los bloques `upstream`, forzando la reevaluación periódica de las IPs internas.

---

## 5. Posibles Mejoras a Futuro

1. **Alta Disponibilidad de Persistencia (Redis Sentinel):** Incorporar un esquema primario-réplica gestionado por nodos Sentinel para failover automático de la base de datos sin pérdida de transacciones.
2. **Entrega Continua con Enfoque GitOps:** Automatizar el despliegue en la nube mediante agentes tipo Watchtower o ArgoCD, sincronizando el estado de ejecución ante la publicación de nuevos tags en GHCR.
3. **Observabilidad Centralizada:** Instrumentar métricas mediante Prometheus y Grafana (latencia HTTP, uso de memoria en Redis y tasas de error), complementado con centralización de logs estructurados.
4. **Seguridad Perimetral y Terminación TLS:** Automatizar el aprovisionamiento y renovación de certificados SSL/TLS mediante Let's Encrypt y Certbot configurado como contenedor complementario en Nginx.

---

## 6. Matriz de Trazabilidad Técnica

| Componente del Sistema | Implementación Técnica | Estado de Verificación | Evidencia Técnica Asociada |
| :--- | :--- | :---: | :--- |
| **Aplicación Web (Frontend)** | React 19 + TypeScript + Vite, empaquetado en Nginx alpine. | **Verificado** | 7 pruebas unitarias aprobadas, typecheck sin errores, build reproducible. |
| **API REST (Backend)** | Fastify 5 + TypeScript, arquitectura stateless. | **Verificado** | Endpoints operativos (`/api/incidents`, `/health`, `/ready`, `/whoami`), typecheck sin errores. |
| **Persistencia (Redis)** | Redis 7 Alpine, estructuras Hash + Set, volumen persistente. | **Verificado** | Procedimiento de consulta CLI documentado en `docs/cheatsheet-redis.md` y verificado en `docs/evidencia-m2.md`. |
| **Proxy y Balanceo Local** | Nginx con Round-Robin, 3 nodos web y 3 nodos API. | **Verificado** | Trazabilidad por `X-Instance-ID` y tolerancia a la detención de nodos documentada en `docs/evidencia-m2.md`. |
| **Automatización CI/CD** | GitHub Actions para tests, linting y typecheck. | *En integración* | Scripts locales funcionales; workflows en `.github/workflows/` en proceso de publicación. |
| **Seguridad (SAST / SCA)** | Escaneo estático de código, dependencias y secretos. | *En integración* | Definición de análisis de seguridad para el pipeline de integración. |
| **Registro de Imágenes** | GitHub Container Registry (GHCR) para imágenes de Web y API. | *En integración* | Dockerfiles optimizados listos para publicación automatizada. |
| **Despliegue en Cloud** | Stack Docker Compose en VM IaaS consumiendo imágenes de GHCR. | *Preparado para despliegue* | `docker-compose.cloud.yml` y `nginx.cloud.conf` validados; guía operativa en `docs/cloud-deployment.md`. |
