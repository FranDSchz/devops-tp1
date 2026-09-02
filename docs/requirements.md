# Requisitos del TP1 2026

Resumen operativo del documento **TP1 - Aplicacion web, API y servicio Redis o DB contenerizados - DevOps UTN FRRe 2026** y de la aclaracion de seguridad indicada en clase.

Este archivo no reemplaza a la consigna oficial. Ante una diferencia, prevalece el documento entregado por la catedra y las aclaraciones posteriores del docente.

## Requisitos funcionales

- La solucion debe incluir una aplicacion web, una API y Redis o una DB.
- La aplicacion web consume los datos expuestos por la API.
- La API es el unico servicio con acceso directo a Redis.
- La aplicacion debe enviar, modificar y recuperar informacion almacenada en Redis.
- La aplicacion web y la API deben estar contenerizadas.
- Redis debe ejecutarse en un contenedor.

## Requisitos tecnicos

- Gestionar la arquitectura local mediante Docker Compose o una alternativa equivalente.
- Ejecutar localmente la arquitectura completa con reverse proxy y replicas.
- Implementar tres nodos de la aplicacion web y tres nodos de la API como interpretacion conservadora de la consigna.
- Demostrar balanceo de carga.
- Demostrar tolerancia a la caida de una instancia.
- Ejecutar tests unitarios mediante GitHub Actions.
- Ejecutar SAST mediante GitHub Actions.
- Cubrir tambien SCA y deteccion de secretos, segun la aclaracion realizada en clase.
- Mostrar un badge del estado del CI y otro del analisis de seguridad.
- Construir y publicar las imagenes propias en un Registry mediante GitHub Actions.
- Desplegar en cloud desde las imagenes publicadas en el Registry.
- Ejecutar al menos una instancia funcional en cloud; las replicas en cloud son opcionales.

## Decisiones de cumplimiento

| Requisito | Implementacion prevista |
| --- | --- |
| Aplicacion web | React + Vite + TypeScript |
| API | Fastify + TypeScript |
| Redis | Contenedor oficial compartido por las replicas |
| Proxy y balanceo | Nginx |
| Replicas locales | 3 web + 3 API |
| Orquestacion local | Docker Compose |
| Tests unitarios | Vitest |
| SAST | CodeQL |
| SCA y Secrets | Trivy |
| Registry | GHCR |
| Cloud | Render como primera opcion |

## Entregables

- Aplicacion funcionando durante el coloquio.
- Coloquio grupal con evaluacion personal.
- Enlace al repositorio grupal en GitHub.
- Aplicacion desplegada en cloud desde un Registry de imagenes.
- Informe o presentacion con resultados, dificultades y mejoras futuras.

## Rubrica

| Criterio | Puntos |
| --- | ---: |
| Aplicaciones funcionando localmente o en la nube | 30 |
| Visualizacion de variables en Redis o DB | 10 |
| GitHub Actions publicando imagenes en Registry | 20 |
| CI con tests y analisis de seguridad | 10 |
| Aplicacion funcionando en servicio externo | 20 |
| Coloquio y presentacion personal | 10 |
| **Total** | **100** |

## Evidencias que deben prepararse

- Crear y modificar un incidente desde la web.
- Verificar los datos mediante `redis-cli`.
- Identificar que replicas atendieron distintas peticiones.
- Detener una replica y demostrar que la aplicacion continua respondiendo.
- Mostrar ejecuciones exitosas de CI y Security.
- Mostrar las imagenes publicadas en GHCR.
- Mostrar la aplicacion desplegada externamente.

## Fecha de entrega

La consigna indica **lunes 14 de septiembre de 2026**, con coloquio grupal.

