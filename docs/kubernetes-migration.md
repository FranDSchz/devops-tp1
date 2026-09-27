# Kubernetes — camino alternativo de orquestación

> **Estado: investigacion cerrada, implementacion pendiente.**
> **No es parte del entregable evaluado del TP1.** El camino de produccion sigue siendo
> Docker Compose en AWS EC2 (`docs/cloud-deployment.md`, ADR D-008). Esta rama existe para
> aprender Kubernetes sobre una aplicacion que ya lo soporta por diseño.
>
> **Rama:** `learning/kubernetes`. **Nunca se mergea a `main`.** Nace desde
> `feature/instance-fleet-panel` (el HEAD con el registro de flota), no desde `main`,
> porque `main` esta tres commits atras: le faltan el ZSET de heartbeats, el panel de
> replicas y el prune de documentacion.
>
> **Alcance de escritura:** esta rama **no toca `apps/`** ni los archivos de
> `infrastructure/compose/` ni `infrastructure/nginx/`. Es 100% infraestructura nueva.

---

## 1. Que aporta Kubernetes sobre Docker Compose

El salto mental no es aprender otra herramienta: es el **control loop de
reconciliacion**. Compose declara un estado final y el demonio lo aplica una vez.
Kubernetes declara un estado final (`spec.replicas: 3`) y un controlador lo reitera
**para siempre**: si un pod desaparece, el reconciliador vuelve a crear uno. Borrar un
pod no es "reiniciar un servicio", es inyectar un evento que el sistema absorbe solo.

Mapeo de cada pieza que ya tenemos:

| Docker Compose | Kubernetes | Que cambia en la practica |
| --- | --- | --- |
| `container_name: opsboard-api-1` (fijo) | `Deployment` con `replicas: 3` | La identidad pasa a ser **efimera**: el nombre del pod. |
| `depends_on: condition: service_healthy` | `readinessProbe` + initContainer | Readiness saca el pod del Service en vez de frenar el arranque. |
| `upstream` + `resolver 127.0.0.11` (Compose) | `Service` + kube-proxy + readiness | El balanceo deja de depender de DNS dinamico. |
| `restart: unless-stopped` | kubelet + ReplicaSet | El reemplazo es automatico y observable. |
| `docker compose up -d` (recrea todo) | Rolling update | Cambio de version sin downtime. |
| Redes `frontend` / `backend` | `NetworkPolicy` | Aislamiento declarativo, no topologia de redes. |
| Volumen nombrado `redis-data` | PVC + `volumeClaimTemplates` | El volumen acompana a la identidad del pod. |
| Editar `FLEET_SIZE` a mano | Downward API (parcial) | Ver la trampa 3: **no** hay fieldRef para `spec.replicas`. |
| `docker logs` / `docker compose logs` | `kubectl logs` | Sin agregacion: la principal falta frente a `docker compose logs`. |

Tres conceptos que hay que tener claros antes de escribir un manifest:

- **Service vs Pod.** Un Pod es desechable; un Service es un nombre estable con un
  selector que kube-proxy convierte en un conjunto de endpoints. Es el sustituto
  exacto del `upstream` de Nginx, pero recalculado automaticamente.
- **liveness vs readiness.** `/health` es liveness (¿el proceso esta vivo? si no, se
  reinicia). `/ready` es readiness (¿puede atender trafico? si no, se saca del Service
  sin reiniciar nada). Confundirlos es el error mas comun: un readiness con logica de
  liveness reinicia la app cada vez que Redis se ralentiza.
- **Selector inmutable.** El `spec.selector` de un Deployment **no se puede cambiar
  despues**: la API lo rechaza. Si el label del pod no calza exacto con el selector, el
  Deployment queda invalido. Es el error que mas DUDA genera la primera vez.

---

## 2. Restricciones del entorno (medidas, no supuestas)

| Dato | Valor | Fuente |
| --- | --- | --- |
| Instancia cloud | EC2 `t3.micro`, Ubuntu 24.04, `us-east-2` | `docs/report.md:136` |
| RAM de la instancia | **1 GiB** (2 vCPU, burstable) | `docs/cloud-deployment.md:8` |
| Stack actual en la EC2 | 8 contenedores | `docs/report.md:136` |
| Consumo medido del stack | **~320 MB** | verificacion M2/M4 |
| k3s en idle sobre un nodo | 450–550 MB | medido en la investigacion |

**Por que el cluster va local y no en la EC2:** `~320 MB` (app) + `450–550 MB` (k3s) =
**~870 MB de 1024 MB**. Sobre una instancia *burstable* con baseline steal, y con un
rolling update corriendo pod viejo y nuevo en simultaneo, el OOMKill no es un riesgo
teorico: es el resultado esperable en una demo que consiste en matar pods. k3s en
`t3.micro` no es defendible.

**Presupuesto de la maquina donde se implemente:** el host tiene 4 vCPU y ~5.8 GiB de
RAM. Con el stack de Compose arriba quedan **~1.9 GiB libres**, insuficiente. Hay que
bajar Compose antes de arrancar el cluster, y con eso el presupuesto sube a ~4.5 GiB.
Por eso el cluster se pide con `--memory=3072` y no mas.

---

## 3. Roadmap de implementacion

Cada fase deja el cluster en un estado verificable. No avanzar sin cumplir el criterio.

### F0 — Preflight del host

- [ ] `docker compose down` en `infrastructure/compose` (libera ~320 MB, indispensable).
- [ ] `docker system df` para ver cuanto hay que recuperar si el host sigue apretado.
- [ ] `minikube version` y `kubectl version --client` (ya instalados en el entorno de desarrollo).
- [ ] `minikube delete` — **obligatorio** si el perfil ya existe: el perfil actual se
      creo sin Calico y la CNI no se puede cambiar sobre un cluster vivo.

### F1 — Levantar el cluster

Todos los comandos de este documento usan `kubectl` a secas: `minikube start` deja el
contexto configurado como actual, asi que funciona directo. Si el contexto no es el del
cluster (o hay mas de un perfil), `minikube kubectl ...` es el equivalente explicito.

- [ ] `minikube start --driver=docker --cni=calico --cpus=3 --memory=3072`
- [ ] `minikube addons enable ingress` (ingress-nginx: el addon que mas RAM consume, ~100 MB)
- [ ] `kubectl get nodes -o wide` y `kubectl get pods -A` para ver la base.
- [ ] `kubectl get pods -n kube-system` para confirmar que `coredns` arranco.

**Criterio:** un nodo `Ready` y los pods de `calico-node`, `coredns` y
`ingress-nginx-controller` en `Running`.

### F2 — Imagenes

- [ ] `docker build -f apps/api/Dockerfile -t opsboard-api:local .`
- [ ] `docker build -f apps/web/Dockerfile -t opsboard-web:local .`
- [ ] `minikube image load opsboard-api:local opsboard-web:local`
- [ ] `minikube image ls | grep opsboard`

**Criterio:** las dos imagenes aparecen en el listado del nodo. Sin esto, cualquier
Deployment queda en `ErrImagePull` (trampa 4).

### F3 — Manifests (`infrastructure/k8s/`)

- [ ] `base/namespace.yaml`
- [ ] `base/configmap.yaml`
- [ ] `base/redis-statefulset.yaml` + los dos Services de Redis
- [ ] `base/api-deployment.yaml` + `base/api-service.yaml`
- [ ] `base/web-deployment.yaml` + `base/web-service.yaml`
- [ ] `base/ingress.yaml`
- [ ] `base/networkpolicy.yaml`
- [ ] `base/kustomization.yaml`
- [ ] `overlays/local/kustomization.yaml` (replicas, imagenes, pullPolicy)
- [ ] `kubectl kustomize infrastructure/k8s/overlays/local > /tmp/render.yaml` para revisar el render
- [ ] `kubectl apply -k infrastructure/k8s/overlays/local`
- [ ] `kubectl rollout status deploy/api -n opsboard` y el mismo para `web`

**Criterio:** los 7 pods (`api` x3, `web` x3, `redis`) en `Running`, y
`minikube service ingress-nginx-controller -n ingress-nginx --url` devuelve una URL que
responde. Ojo: **no** `minikube service web --url` — el Service de la app es ClusterIP y
`minikube service` solo expone LoadBalancer y NodePort (ver el runbook de la seccion 6).

### F4 — Demos con evidencia

- [ ] Self-healing, rolling update, rollback y scaling (seccion 6).
- [ ] Las trampas de la seccion 5, sobre todo la 1 (NetworkPolicy) y la 3 (`FLEET_SIZE`).
- [ ] Re-demostrar round-robin y failover, que en K8s los da otro mecanismo.

### F5 — Cierre

- [ ] `infrastructure/k8s/README.md` con el runbook y el teardown.
- [ ] Evidencia pegada en este documento.
- [ ] PR abierto contra `main` **con la etiqueta de material de estudio**, sin mergear.

---

## 4. Los cambios a introducir

### 4.1 `base/namespace.yaml`

Namespace `opsboard`. Aislar todo en un namespace propio es lo que vuelve aplicables las NetworkPolicy y
los ResourceQuota: sin namespace no hay a que aplicarse un `namespaceSelector`.

### 4.2 `base/configmap.yaml`

`REDIS_HOST: redis`, `REDIS_PORT: "6379"`, `PORT: "3000"`, `FLEET_SIZE: "3"`.
Mismos valores que el `environment` de los compose, para que el comportamiento sea
comparabile.

### 4.3 `base/redis-statefulset.yaml`

Un `StatefulSet` con 1 replica y `volumeClaimTemplates` (no un Deployment con una PVC
suelta: el vinculo estable entre identidad y volumen es justamente lo que aporta el
controller). Requiere dos Services:

- **headless** (`clusterIP: None`, el `serviceName` del StatefulSet): identidad estable
  `redis-0.redis-headless.opsboard.svc`.
- **ClusterIP** (`redis`): el que usan las replicas de la API como `REDIS_HOST`.

`command: ["redis-server", "--appendonly", "yes"]`, replicando el flag de los compose.
`volumeClaimTemplates` con `storageClassName: standard` (la que provee minikube) y 1 Gi.

### 4.4 `base/api-deployment.yaml`

```yaml
replicas: 3
strategy:
  rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
template:
  metadata:
    labels: { app: opsboard-api }
  spec:
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000          # el usuario "node" de node:22-alpine
      seccompProfile: { type: RuntimeDefault }
    terminationGracePeriodSeconds: 30
    containers:
      - name: api
        image: opsboard-api:local
        imagePullPolicy: IfNotPresent
        env:
          - name: INSTANCE_ID
            valueFrom:
              fieldRef: { fieldPath: metadata.name }   # Downward API
          - name: REDIS_HOST
            valueFrom: { configMapKeyRef: { name: opsboard-config, key: REDIS_HOST } }
          # ... REDIS_PORT, PORT, FLEET_SIZE
        ports: [{ containerPort: 3000 }]
        livenessProbe:
          httpGet: { path: /health, port: 3000 }
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 2
          failureThreshold: 3
        readinessProbe:
          httpGet: { path: /ready, port: 3000 }
          periodSeconds: 5
          timeoutSeconds: 2
          failureThreshold: 2
        lifecycle:
          preStop: { exec: { command: ["sh", "-c", "sleep 5"] } }
        resources:
          requests: { cpu: 50m, memory: 96Mi }
          limits:   { memory: 192Mi }
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities: { drop: ["ALL"] }
        volumeMounts:
          - { name: tmp, mountPath: /tmp }
    volumes:
      - name: tmp
        emptyDir: {}
```

Por que asi:

- **`INSTANCE_ID` por Downward API.** `metadata.name` es lo unico disponible; ver la
  trampa 3 para por que `api-1/2/3` no puede seguir siendo fijo. El codigo de la app no
  cambia: `getInstanceId()` ya lee la variable.
- **Cero cambios de app.** `node:22-alpine` corre como uid 1000 sin escribir nada en
  runtime; con `emptyDir` en `/tmp` la rootfs read-only no molesta. El `/app` de la
  imagen es world-readable.
- **`maxUnavailable: 0` explicito.** Los defaults son 25% para los dos parametros, con
  `maxSurge` redondeando hacia arriba y `maxUnavailable` hacia abajo. Con `replicas: 3`
  eso ya da `maxSurge: 1, maxUnavailable: 0` sin escribir nada. Lo que hace falta es
  **fijarlo** por otra razon: a partir de `replicas: 4` los defaults redondean a
  `maxUnavailable: 1` y el rollout admitiria downtime. Escrito a 0, no.
- **`preStop: sleep 5`.** Le da 5 s al Ingress para sacar el pod de los endpoints
  antes del `SIGTERM`, para que no caiga una peticion en transito.
- **La API ya maneja `SIGTERM`** (`apps/api/src/index.ts:73`): limpia el heartbeat,
  cierra Fastify y cierra Redis. Ojo: **no** llama `process.exit(0)`. Si el proceso no
  baja solo, el pod queda en `Terminating` hasta agotar los 30 s. **Verificar en la
  demo 2**; si se cuelga, agregar el `exit(0)` (y su test). No se cambia ahora.

### 4.5 `base/web-deployment.yaml`

La complicacion de web es el `CMD` de `apps/web/Dockerfile:23`, que escribe
`instance.json` con `$INSTANCE_ID` al arrancar: con `readOnlyRootFilesystem: true` el
write falla y el pod entra en `CrashLoopBackOff`. **Se resuelve solo en el manifiesto,
sin tocar la imagen**, montando un `emptyDir` sobre el archivo puntual:

```yaml
        volumeMounts:
          - name: instance
            mountPath: /usr/share/nginx/html/instance.json
            subPath: instance.json     # <-- el write del CMD cae en el volumen
          - { name: cache, mountPath: /var/cache/nginx }
          - { name: run,   mountPath: /var/run }
          - { name: tmp,   mountPath: /tmp }
      volumes:
        - name: instance
          emptyDir: {}
        # cache, run, tmp tambien emptyDir
```

`subPath` es lo que permite montar **un archivo** de un volumen: el `CMD` sigue
escribiendo en la misma ruta y ahora la escritura cae en el `emptyDir`, que es
escribible. El `root` de los assets (`/usr/share/nginx/html`) sigue viniendo de la
imagen, intacto. Aclaracion: el archivo no existe todavia en el volumen, y ahi hay un
detalle de kubelet que puede fallar (trampa 7).

- **Liveness y readiness en `/health`**, que `apps/web/nginx.conf:12` ya sirve estatico.
- **Caching:** el `no-store` que `infrastructure/nginx/nginx.conf:46` ponia sobre
  `/instance.json` vivia en el edge de Compose y **se pierde** con el Ingress. Sin el,
  el navegador cachea la respuesta y la demo de round-robin web miente. Compensar en el
  Ingress con un `configuration-snippet` para ese path (trampa 6).
- **Limitacion honesta:** web corre **como root**, porque `nginx:alpine` escucha en el
  puerto 80 y `runAsNonRoot: true` sin `CAP_NET_BIND_SERVICE` no puede tomar un puerto
  privilegiado. Hacerlo bien requiere `nginxinc/nginx-unprivileged` (uid 101, puerto
  8080), o sea un cambio de Dockerfile que no tiene sentido en una rama que no mergea.
  Documentado como deuda, no como bug.

### 4.6 `base/ingress.yaml`

Un `Ingress` class `nginx` con estas reglas, **en este orden** (gana la coincidencia
mas larga, no el orden del archivo):

| Path | Service | Notas |
| --- | --- | --- |
| `/api` (Prefix) | `api:3000` | **Sin** `rewrite-target` (trampa 5). |
| `/health` (Exact) | `api:3000` | Debe ser explicito: web tambien sirve `/health`. |
| `/ready` (Exact) | `api:3000` | Idem. |
| `/whoami` (Exact) | `api:3000` | |
| `/instance.json` (Exact) | `web:80` | Con el `no-store` de la trampa 6. |
| `/` (Prefix) | `web:80` | Catch-all del SPA. |

Es la traduccion directa de los `location` de `infrastructure/nginx/nginx.conf`. Ningun
Service de la app necesita `type: NodePort`: el Ingress enruta por el ClusterIP desde
dentro del cluster.

### 4.7 `base/networkpolicy.yaml`

Con Calico, el patron Dual-Homed de `architecture.md` §1.2 pasa de "dos redes Docker"
a declarativo. Con el CNI por defecto de minikube esto no se cumple (trampa 1), asi que
la red de seguridad del enunciado solo es demostrable con `--cni=calico`.

Politicas (partiendo de un default-deny):

1. `default-deny-all` — deny ingreso y egreso en `opsboard`.
2. Permitir ingreso desde `ingress-nginx` (namespace `ingress-nginx`) hacia `web` y `api`.
3. Permitir `api -> redis` TCP 6379.
4. Permitir egreso DNS a `kube-system` (UDP y TCP 53) para todos: **es el paso que
   todo el mundo olvida**, y sin el el DNS falla y todo el namespace se cae solo.

### 4.8 Kustomize

`base/` sin replicas ni imagenes hardcodeadas; `overlays/local/` pone `replicas: 3`,
`opsboard-{api,web}:local` e `imagePullPolicy: IfNotPresent`. Kustomize viene embebido
en `kubectl` (v5.8.1): no hay que instalar nada, y `helm` tampoco hace falta.

```bash
kubectl kustomize infrastructure/k8s/overlays/local    # ver el render
kubectl apply  -k infrastructure/k8s/overlays/local
```

### 4.9 Lo que NO cambia

- **`apps/`**: cero cambios. Los dos unicos candidatos eran el `instance.json` (resuelto
  en el manifiesto) y el `SIGTERM` (a verificar, no a cambiar preventivamente).
- **Los compose y la config de Nginx**: quedan intactos. Son el camino evaluado.
- **`docs/` canonicos y `.github/`**: sin tocar. No hay ADR que reevalue D-008 porque
  D-008 sigue siendo la decision vigente; `architecture.md` §6 dice que K8s esta fuera
  de alcance y **sigue siendo cierto**.

---

## 5. Las siete trampas

Las que hacen perder horas. La 1 es una correccion a la investigacion original (proponia
NetworkPolicy sin notar que el CNI por defecto no lo aplica). La 2 y la 3 son supuestos
que hay que verificar contra el entorno, no de leer. Las 4 a 7 son las que solo aparecen
cuando algo falla, y por eso no se pueden anticipar leyendo.

**1. NetworkPolicy no se cumple con el CNI por defecto.** minikube usa `kindnet`, que
**acepta y descarta** los objetos NetworkPolicy: el manifest es valido, el API server
lo acepta, y la politica no hace nada. Un `deny-all` "aplicado" que no bloquea nada es
peor que no tener politica, porque aparenta seguridad. Con Calico si se cumple.

**2. `readOnlyRootFilesystem` en `nginx:alpine`.** Los scripts del entrypoint escriben en
`/etc/nginx/conf.d` cuando existe un `/etc/nginx/templates/*.template` (no hay) y parchean
`default.conf` solo si matchea `listen ...80;` (el conf de web usa
`listen 80 default_server;`, no matchea). **Es lo primero que hay que verificar**: si el pod
no levanta, el fallback es sacar
`readOnlyRootFilesystem` de web o migrar a `nginxinc/nginx-unprivileged`.

**3. `FLEET_SIZE` no se puede derivar de `spec.replicas`.** La Downward API expone
`metadata.name`, `metadata.namespace`, `metadata.uid`, `metadata.labels['k']`,
`metadata.annotations['k']`, `spec.nodeName`, `spec.serviceAccountName`, `status.hostIP`,
`status.podIP` y `status.podIPs`. **No hay ningun campo para la cantidad de replicas.**
O sea: `FLEET_SIZE` queda en el ConfigMap y hay que cambiarlo a mano junto al
`kubectl scale`. El panel va a mentir y esa es la demo 3.

**4. Imagenes: nada de `latest`.** Las imagenes de `ghcr.io/frandschz/*` no son
publicas garantizadas y el registry puede no ser alcanzable desde el cluster. Con
`image: latest` + `imagePullPolicy: Always` (el default de `:latest`) el pod queda en
`ErrImagePull` para siempre. Solucion: `minikube image load` + tag explicito +
`IfNotPresent`.

**5. El Ingress NO debe reescribir paths.** El proxy de Compose hacia
`proxy_pass http://api_upstream;` **sin** URI final, o sea que conserva el path. Un
Ingress con el annotation estandar `nginx.ingress.kubernetes.io/rewrite-target: /$2`
borra el prefijo y la API recibe `/incidents` en vez de `/api/incidents`: todos los
`fetch` del frontend empiezan a dar 404. Para replicar el comportamiento de Compose, el
Ingress va **sin** ningun rewrite.

**6. El `no-store` de `/instance.json` se pierde.** Esta no estaba en la investigacion:
vivia en `infrastructure/nginx/nginx.conf:46`, que es el edge de Compose. Al sacarlo
del camino, el Ingress tiene que reponerlo o el navegador cachea y la demo de
round-robin web deja de alternar.

**7. `subPath` sobre un archivo que todavia no existe.** El montaje por `subPath` de
`instance.json` (§4.5) apunta a un archivo que la imagen **no** trae: lo crea el `CMD`
al arrancar. kubelet normalmente lo crea como archivo vacio y el montaje funciona, pero
si la version de kubelet no lo hace, el pod queda en `CreateContainerError` con un
`failed to prepare subPath`. La salida determinista, si aparece, es un `initContainer`
que hace `touch /shared/instance.json` sobre el mismo `emptyDir` antes de que arranque
el contenedor principal. **Verificar en el primer arranque.**

---

## 6. Pruebas y demos

### Demo 1 — Self-healing (esto Compose no lo tiene)

Compose tiene `restart: unless-stopped`, que reinicia el contenedor. Kubernetes no
"reinicia": **reemplaza**, y el pod muerto desaparece del Service antes de que el
reemplazo exista, asi que no hay ni un 502.

```bash
kubectl -n opsboard get pods -l app=opsboard-api -w

# en otra terminal
kubectl -n opsboard delete pod <api-pod>
kubectl -n opsboard get pods -w
```

**Evidencia esperada:** el pod `Terminating`, un `Pending` con `ContainerCreating`, y un
`Running` nuevo con **otro nombre**. Sin intervencion. Anotar los milisegundos entre el
borrado y el pod nuevo en `Running`.

Refuerzo desde el Service, que es la parte no obvia:

```bash
kubectl -n opsboard get endpoints api   # 3 endpoints; baja a 2 y vuelve a 3
```

### Demo 2 — Rolling update y rollback

```bash
# cambiar la imagen -> rollout
kubectl -n opsboard set image deploy/api api=opsboard-api:otra
kubectl -n opsboard rollout status deploy/api
kubectl -n opsboard rollout history deploy/api

# volver atras -> rollback
kubectl -n opsboard rollout undo deploy/api
kubectl -n opsboard rollout status deploy/api
```

Con `maxSurge: 1, maxUnavailable: 0` se ve **un pod nuevo conviviendo con los tres
viejos** y las peticiones nunca se cortan: mientras el pod nuevo no pasa readiness, no
recibe trafico. Comparar contra lo que hacia Compose, que recreaba los 8 contenedores.

Verificar aca que el `SIGTERM` de la API no deja pods colgados en `Terminating` (ver
4.4). Si alguno se pasa de los 30 s, agregar `process.exit(0)` al handler.

### Demo 3 — Scaling

```bash
kubectl -n opsboard scale deploy/api --replicas=5
kubectl -n opsboard get pods -l app=opsboard-api
kubectl -n opsboard get endpoints api
```

**Evidencia esperada:** 5 pods, 5 endpoints, y el panel web mostrando `5 / 3` porque
`FLEET_SIZE` sigue en 3 (trampa 3). Desplegar con
`kubectl -n opsboard patch configmap opsboard-config -p '{"data":{"FLEET_SIZE":"5"}}'`
y observar como el contador se corrige, lo que **no** cambia los pods ya arrancados
(pero si los que se creen despues). Revertir con `--replicas=3`.

### Demo 4 — La red de seguridad (NetworkPolicy)

Con `--cni=calico`. La clave de una prueba de NetworkPolicy es que el bloqueo es
**silencioso**: no hay `connection refused`, hay timeout. Asi que "no responde" no
alcanza como evidencia; hay que comparar el tiempo.

**Permitido** — la API habla con Redis. `PING` real, no un `wget` a un puerto que no
habla HTTP:

```bash
kubectl -n opsboard exec deploy/api -- node -e "
const s = require('net').createConnection(6379, 'redis');
s.setTimeout(2000, () => { console.log('TIMEOUT: bloqueado'); process.exit(1); });
s.on('connect', () => s.write('PING\r\n'));
s.on('data', (d) => { console.log('CONECTADO:', d.toString().trim()); process.exit(0); });
"
# esperado: CONECTADO: +PONG
```

**Denegado** — la web no habla ni con Redis ni con la API:

```bash
time kubectl -n opsboard exec deploy/web -- wget -qO- -T 2 http://api:3000/health
# esperado: wget: connection timed out  tras ~2 s exactos
```

**El control que hace la prueba valida:** el mismo `wget` desde `deploy/api` a la misma
URL responde en milisegundos. Si tambien se colgara, seria un problema de la app y no de
la politica:

```bash
time kubectl -n opsboard exec deploy/api -- wget -qO- -T 2 http://api:3000/health
# esperado: {"status":"ok",...}  inmediato
```

Ese `api -> redis` permitido con `web -> redis` denegado **es** el patron Dual-Homed de
`architecture.md` §1.2, demostrado. Para ver la diferencia de verdad, repetir el `wget`
denegado contra un cluster arrancado **sin** `--cni=calico`: responde en vez de colgarse,
y con eso queda demostrado que kindnet aceptaba las politicas sin aplicarlas (trampa 1).

### Demo 5 — Lo que ya funcionaba, re-demostrado

Round-robin y failover, que en K8s los da otro mecanismo. Con el Ingress hay que pegarle
al **controlador**, no al Service de `web` (los Services de la app son ClusterIP y
`minikube service` solo expone LoadBalancer y NodePort):

```bash
URL=$(minikube service ingress-nginx-controller -n ingress-nginx --url)
echo $URL

for i in $(seq 1 6); do curl -s "$URL/health"; echo; done
```

Se alternan los pods (los nombres ahora son largos:
`opsboard-api-7d9f8b6c4-x2klm`, que es el costo de `metadata.name` como `INSTANCE_ID`).
Con un pod eliminado, el Service lo saca de los endpoints y el round-robin reparte entre
los que quedan, sin el `proxy_next_upstream error timeout http_502` de Nginx.

Y el panel de flota, que en K8s pasa a ser informacion operativa real:

```bash
kubectl -n opsboard delete pod <api-pod>
sleep 16
curl -s "$URL/api/instances" | jq '.count, .expected, [.instances[].id]'
```

Como el TTL logico del ZSET es de 15 s, el pod muerto tarda **mas** en desaparecer del
registro que del Service: 0 s en los endpoints, hasta 15 s en el panel. Es la misma
tolerancia que ya se demuestra en `architecture.md` §5, con un matiz que conviene
explicar.

### Runbook

```bash
minikube service ingress-nginx-controller -n ingress-nginx --url   # URL de entrada
kubectl -n opsboard logs -l app=opsboard-api -f
kubectl -n opsboard get pods -o wide
kubectl -n opsboard describe pod <pod>     # el 90% de los diagnosticos
kubectl -n opsboard rollout undo deploy/api
kubectl -n opsboard delete -k infrastructure/k8s/overlays/local   # baja, conserva la PVC
minikube stop
minikube delete                       # si la RAM aprieta entre sesiones
```

Si el addon de ingress no levanta (es el que mas RAM consume y el primero en caer si el
host aprieta), el fallback sin tocar los manifests es pegarle al Service por
`port-forward`, saltandose el Ingress:

```bash
kubectl -n opsboard port-forward svc/api 3000:3000   # solo la API, sin Ingress
```

O, para probar el Ingress de verdad, agregar `nodePort` al Service del controlador y
usar `minikube service ingress-nginx-controller -n ingress-nginx --url`.

---

## 7. Limitaciones conocidas

- **Un solo nodo:** no se pueden demostrar scheduling entre nodos, `taints`/`tolerations`
  ni `drain` de verdad. Es la limitacion de la maquina, no del planteo. Con 4 vCPU y
  5.8 GiB no entra un segundo nodo con el stack corriendo.
- **`FLEET_SIZE` manual** (trampa 3).
- **web como root** (§4.5).
- **Sin agregacion de logs ni metricas:** `kubectl logs` a mano. Es lo que mas duele
  de un cluster chico y lo que justificaria Loki/Prometheus mas adelante.
- **Sin alta disponibilidad real:** un nodo es un punto unico de falla, y la PVC de Redis
  esta atada a ese nodo. Un cluster de mas de un nodo, o Redis gestionado, es lo que
  resuelve el Sentinel que ya esta en `report.md` §5.

## 8. Procedencia de este documento

La version original era una investigacion de factibilidad: la aritmética de RAM de la EC2,
el analisis de las tres opciones de cluster (local, k3s en la EC2, gestionado) y el
calculo que descarta k3s en el `t3.micro`. Todo eso se conservo, en la seccion 2 y en las
restricciones de la 1. A eso se le sumo la teoria minima, el roadmap por fases, la
especificacion manifest por manifest, las trampas y las demos con su evidencia esperada.

Correcciones a aquella investigacion, una linea cada una:

1. El NetworkPolicy no se cumple con el CNI por defecto de minikube: hay que arrancar con
   `--cni=calico` o la politica es decorativa.
2. `FLEET_SIZE` no se puede derivar de `spec.replicas`: no existe tal campo en la Downward
   API, asi que queda en el ConfigMap y se cambia a mano.
3. El riesgo de que ioredis no sobreviva al failover estaba sobredimensionado para una
   replica unica: se resuelve apuntando `REDIS_HOST` al Service ClusterIP en vez de al DNS
   headless del pod.
4. El conflicto entre el `CMD` que escribe `instance.json` y la rootfs read-only tiene
   salida en el manifiesto, con `emptyDir` + `subPath`, sin tocar la imagen.
5. La aritmetica de `k3s` en la EC2 se mantiene: ~870 MB de 1 GiB no es defendible. Por eso
   el cluster va local.
