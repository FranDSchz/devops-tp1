# Blue-Green Deployment

## Arquitectura

Dos entornos completos (blue y green) corren en paralelo compartiendo una única instancia de Redis. Nginx enruta el tráfico al entorno activo; el switch no requiere reiniciar contenedores.

```
                    ┌─────────────────────────────────────┐
                    │           Redis (compartido)         │
                    └────────────┬────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
   ┌─────▼──────┐         ┌──────▼─────┐                 │
   │ blue stack │         │ green stack│                  │
   │  api ×3    │         │  api ×3    │                  │
   │  web ×3    │         │  web ×3    │                  │
   └─────┬──────┘         └──────┬─────┘                  │
         └───────────────────────┘                        │
                         │                                │
                   ┌─────▼─────┐                          │
                   │   Nginx   │◄─── env.conf (activo) ───┘
                   │  :8080    │
                   └───────────┘
```

## Archivos clave

| Archivo | Descripción |
|---|---|
| `infrastructure/compose/docker-compose.blue-green.yml` | Stack completo: redis, blue ×6, green ×6, nginx |
| `infrastructure/nginx/nginx.blue-green.conf` | Upstreams de ambos entornos + include del entorno activo |
| `infrastructure/nginx/active/blue.conf` | Server block apuntando a blue |
| `infrastructure/nginx/active/green.conf` | Server block apuntando a green |
| `infrastructure/nginx/active/env.conf` | Entorno activo actual (se sobreescribe en cada switch) |
| `infrastructure/scripts/switch-env.sh` | Script de switch y rollback |
| `infrastructure/scripts/load-test.sh` | Script de prueba de carga con detección de 5xx |

## Comandos

```bash
# Levantar el stack completo
docker compose -f infrastructure/compose/docker-compose.blue-green.yml up -d

# Verificar entorno activo
curl http://localhost:8080/health

# Promover green (deploy nueva versión)
./infrastructure/scripts/switch-env.sh green

# Rollback a blue
./infrastructure/scripts/switch-env.sh blue

# Prueba de carga (30s contra /health)
./infrastructure/scripts/load-test.sh http://localhost:8080/health 30
```

## Evidencia de switch sin downtime

Prueba realizada el 2026-10-15 con el stack local:

**Switch blue → green (deploy)**

| Métrica | Valor |
|---|---|
| Total requests durante el switch | 131 |
| Requests exitosos (2xx) | 131 |
| Errores 5xx | 0 |
| Tasa de error | 0% |

**Switch green → blue (rollback)**

| Métrica | Valor |
|---|---|
| Total requests durante el rollback | 129 |
| Requests exitosos (2xx) | 129 |
| Errores 5xx | 0 |
| Tasa de error | 0% |
| Tiempo de rollback | 597ms |

El rollback completo (desde el comando hasta nginx recargado y sirviendo blue) tomó **menos de 600ms** sin interrumpir el servicio.

## Cómo funciona el switch

1. `switch-env.sh` copia `blue.conf` o `green.conf` sobre `active/env.conf`
2. Ejecuta `nginx -s reload` dentro del contenedor
3. Nginx termina las conexiones activas gracefully y empieza a usar el nuevo upstream
4. Redis no se reinicia — ambos entornos comparten el mismo estado
