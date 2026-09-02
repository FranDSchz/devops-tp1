# Arquitectura propuesta

## Objetivo

La arquitectura busca demostrar integracion de servicios, contenerizacion, balanceo, tolerancia a fallos y automatizacion sin agregar componentes que no aporten a la consigna.

## Topologia local

```text
                                      +----------------+
                                 +--> | web-1          |
                                 |    +----------------+
                                 +--> | web-2          |
                                 |    +----------------+
Cliente --> reverse-proxy -------+--> | web-3          |
              Nginx              |    +----------------+
                                 |
                                 |    +----------------+
                                 +--> | api-1          | --+
                                 |    +----------------+   |
                                 +--> | api-2          | --+--> Redis
                                 |    +----------------+   |
                                 +--> | api-3          | --+
                                      +----------------+
```

Nginx sera el unico punto de entrada expuesto. Las solicitudes de interfaz se distribuiran entre los nodos web y las solicitudes bajo `/api` entre los nodos API.

## Responsabilidades

### Aplicacion web

- Presentar la lista de incidentes.
- Capturar las acciones del usuario.
- Consumir exclusivamente la API.
- No conectarse directamente a Redis.

### API

- Exponer operaciones REST.
- Validar las solicitudes.
- Leer y escribir en Redis.
- Mantenerse stateless para permitir el balanceo entre replicas.
- Exponer endpoints de salud e identificacion de instancia.

### Redis

- Mantener el estado compartido de los incidentes.
- Ser accesible solamente desde los nodos API.
- Utilizar un volumen local para evitar perdida accidental de datos durante la demostracion.

### Reverse proxy

- Exponer un unico puerto de entrada.
- Enrutar la interfaz y la API.
- Distribuir peticiones entre las replicas.
- Reintentar o redirigir cuando una instancia no responda.

## Demostracion de balanceo y tolerancia

Cada respuesta debera permitir identificar la instancia que la atendio mediante un header o endpoint de diagnostico. La demostracion minima sera:

1. Realizar multiples peticiones y observar diferentes instancias.
2. Detener una replica de API.
3. Repetir las peticiones y comprobar que el servicio continua disponible.
4. Repetir el procedimiento con una replica web.
5. Volver a levantar las instancias detenidas.

No se incorporaran plataformas de observabilidad adicionales para esta demostracion.

## Cloud

La topologia minima en cloud sera una instancia web, una instancia API y un servicio Redis funcionales. Las imagenes propias deben descargarse desde GHCR. Las replicas en cloud quedan como mejora opcional.

Render sera evaluado mediante una prueba temprana. Si no permite desplegar la solucion completa dentro de las restricciones del equipo, se utilizara una VM con Docker Compose como alternativa.

## Fuera de alcance inicial

- Autenticacion y usuarios.
- WebSockets y notificaciones.
- Kubernetes.
- Terraform.
- Service mesh.
- Alta disponibilidad de Redis.
- Prometheus, Grafana o una plataforma completa de logs.

