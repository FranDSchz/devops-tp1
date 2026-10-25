import { useEffect, useRef, useState } from "react";
import "./blue-green-demo.css";

const POLL_MS = 1800;

type Environment = "blue" | "green" | "transition" | "standard" | "offline";
type ActiveEnvironment = "blue" | "green";

interface Snapshot {
  apiInstance: string | null;
  webInstance: string | null;
  redisConnected: boolean | null;
  incidentCount: number | null;
  checkedAt: number;
  failedEndpoints: string[];
}

interface SwitchEvent {
  id: number;
  from: ActiveEnvironment | null;
  to: ActiveEnvironment;
  at: number;
}

interface HealthResponse {
  status: string;
  instance: string;
}

interface WebResponse {
  instance: string;
}

interface ReadyResponse {
  redis: string;
}

interface IncidentResponse {
  id: string;
}

function environmentOf(instance: string | null, role: "api" | "web"): ActiveEnvironment | null {
  if (instance?.startsWith(`blue-${role}-`)) return "blue";
  if (instance?.startsWith(`green-${role}-`)) return "green";
  return null;
}

function currentEnvironment(snapshot: Snapshot | null): Environment {
  if (!snapshot || !snapshot.apiInstance || !snapshot.webInstance) return "offline";

  const api = environmentOf(snapshot.apiInstance, "api");
  const web = environmentOf(snapshot.webInstance, "web");
  if (api && web && api === web) return api;
  if (api || web) return "transition";
  return "standard";
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function readSnapshot(): Promise<Snapshot> {
  const [api, web, redis, incidents] = await Promise.allSettled([
    readJson<HealthResponse>("/health"),
    readJson<WebResponse>("/instance.json"),
    readJson<ReadyResponse>("/ready"),
    readJson<IncidentResponse[]>("/api/incidents"),
  ]);

  const failedEndpoints = [
    api.status === "rejected" ? "/health" : null,
    web.status === "rejected" ? "/instance.json" : null,
    redis.status === "rejected" ? "/ready" : null,
    incidents.status === "rejected" ? "/api/incidents" : null,
  ].filter((path): path is string => path !== null);

  return {
    apiInstance: api.status === "fulfilled" && api.value.status === "ok" ? api.value.instance : null,
    webInstance: web.status === "fulfilled" ? web.value.instance : null,
    redisConnected: redis.status === "fulfilled" ? redis.value.redis === "ok" : null,
    incidentCount: incidents.status === "fulfilled" && Array.isArray(incidents.value)
      ? incidents.value.length
      : null,
    checkedAt: Date.now(),
    failedEndpoints,
  };
}

function timeOf(timestamp: number): string {
  return new Intl.DateTimeFormat("es-AR", { timeStyle: "medium" }).format(timestamp);
}

function environmentLabel(environment: Environment): string {
  switch (environment) {
    case "blue": return "Blue";
    case "green": return "Green";
    case "transition": return "Cambio en curso";
    case "standard": return "Stack habitual";
    default: return "Sin señal";
  }
}

export default function BlueGreenDemo() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<SwitchEvent[]>([]);
  const [checks, setChecks] = useState({ successful: 0, failed: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const previousEnvironment = useRef<ActiveEnvironment | null>(null);
  const eventSequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const next = await readSnapshot();
      if (cancelled) return;

      setSnapshot(next);
      setChecks((current) => ({
        successful: current.successful + (next.apiInstance && next.webInstance ? 1 : 0),
        failed: current.failed + (next.apiInstance && next.webInstance ? 0 : 1),
      }));

      const environment = currentEnvironment(next);
      if ((environment === "blue" || environment === "green") &&
          previousEnvironment.current !== environment) {
        const from = previousEnvironment.current;
        previousEnvironment.current = environment;
        eventSequence.current += 1;
        setEvents((current) => [
          { id: eventSequence.current, from, to: environment, at: next.checkedAt },
          ...current,
        ].slice(0, 8));
      }

      timer = setTimeout(() => void poll(), POLL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshKey]);

  const environment = currentEnvironment(snapshot);
  const isBlue = environment === "blue";
  const isGreen = environment === "green";

  return (
    <div className="bg-demo">
      <header className="bg-demo__header">
        <a className="bg-demo__back" href="/">← Volver a OpsBoard</a>
        <span className="bg-demo__eyebrow">TP2 · Despliegue local</span>
        <div className="bg-demo__heading-row">
          <div>
            <h1>Blue / Green</h1>
            <p>El navegador consulta qué web y qué API responden ahora. Dejá esta página abierta durante el cambio.</p>
          </div>
          <div className={`bg-demo__current bg-demo__current--${environment}`} aria-live="polite">
            <span>Entorno activo</span>
            <strong>{environmentLabel(environment)}</strong>
            <small>{snapshot ? `Última lectura ${timeOf(snapshot.checkedAt)}` : "Consultando…"}</small>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-demo__flow" aria-label="Recorrido del tráfico">
          <div className="bg-demo__path-start">
            <div className="bg-demo__node">
              <span className="bg-demo__node-icon" aria-hidden="true">◉</span>
              <div><strong>Navegador</strong><small>{window.location.host}</small></div>
            </div>
            <span className="bg-demo__arrow" aria-hidden="true">→</span>
            <div className="bg-demo__node bg-demo__node--proxy">
              <span className="bg-demo__node-icon" aria-hidden="true">⇄</span>
              <div><strong>Nginx</strong><small>Envía cada request al entorno activo</small></div>
            </div>
          </div>

          <div className="bg-demo__environments">
            <article className={`bg-demo__environment bg-demo__environment--blue ${isBlue ? "is-active" : ""}`}>
              <div className="bg-demo__environment-heading">
                <span className="bg-demo__environment-letter">B</span>
                <div><h2>Blue</h2><span>3 web · 3 API</span></div>
                <span className="bg-demo__environment-state">{isBlue ? "RECIBE TRÁFICO" : isGreen ? "SIN TRÁFICO" : "SIN CONFIRMAR"}</span>
              </div>
              <div className="bg-demo__environment-detail">
                <span>Web</span><strong>{environmentOf(snapshot?.webInstance ?? null, "web") === "blue" ? snapshot?.webInstance : "—"}</strong>
                <span>API</span><strong>{environmentOf(snapshot?.apiInstance ?? null, "api") === "blue" ? snapshot?.apiInstance : "—"}</strong>
              </div>
            </article>
            <article className={`bg-demo__environment bg-demo__environment--green ${isGreen ? "is-active" : ""}`}>
              <div className="bg-demo__environment-heading">
                <span className="bg-demo__environment-letter">G</span>
                <div><h2>Green</h2><span>3 web · 3 API</span></div>
                <span className="bg-demo__environment-state">{isGreen ? "RECIBE TRÁFICO" : isBlue ? "SIN TRÁFICO" : "SIN CONFIRMAR"}</span>
              </div>
              <div className="bg-demo__environment-detail">
                <span>Web</span><strong>{environmentOf(snapshot?.webInstance ?? null, "web") === "green" ? snapshot?.webInstance : "—"}</strong>
                <span>API</span><strong>{environmentOf(snapshot?.apiInstance ?? null, "api") === "green" ? snapshot?.apiInstance : "—"}</strong>
              </div>
            </article>
          </div>

          <div className="bg-demo__redis">
            <span aria-hidden="true">◆</span>
            <div><strong>Redis compartido</strong><small>El mismo estado para blue y green</small></div>
            <span className={`bg-demo__redis-state ${snapshot?.redisConnected ? "is-ready" : ""}`}>
              {snapshot?.redisConnected === null || snapshot?.redisConnected === undefined
                ? "Sin lectura"
                : snapshot.redisConnected ? "Conectado" : "Sin conexión"}
            </span>
          </div>
        </section>

        {snapshot && (environment === "standard" || environment === "offline" || environment === "transition") && (
          <div className="bg-demo__notice" role="status">
            {environment === "standard"
              ? "Este servidor no está usando el stack blue-green. Iniciá el entorno local de la demo para ver el cambio."
              : environment === "transition"
                ? "La web y la API respondieron desde entornos distintos durante esta lectura. Se volverá a consultar."
                : "No se pudo identificar la web o la API. El panel volverá a consultar automáticamente."}
          </div>
        )}

        <section className="bg-demo__facts" aria-label="Señales observadas">
          <div><span>Web que responde ahora</span><strong>{snapshot?.webInstance ?? "—"}</strong></div>
          <div><span>API que responde ahora</span><strong>{snapshot?.apiInstance ?? "—"}</strong></div>
          <div><span>Incidentes en Redis</span><strong>{snapshot?.incidentCount ?? "—"}</strong></div>
          <div><span>Sondeos web + API</span><strong>{checks.successful} OK · {checks.failed} fallidos</strong></div>
        </section>

        <section className="bg-demo__bottom">
          <div className="bg-demo__timeline">
            <div className="bg-demo__section-heading">
              <div><span>Observación en vivo</span><h2>Cambios detectados</h2></div>
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Actualizar ahora</button>
            </div>
            {events.length ? (
              <ol aria-live="polite">
                {events.map((event) => (
                  <li key={event.id}>
                    <span className={`bg-demo__event-dot bg-demo__event-dot--${event.to}`} />
                    <strong>{event.from ? `${environmentLabel(event.from)} → ${environmentLabel(event.to)}` : `Inicio en ${environmentLabel(event.to)}`}</strong>
                    <time dateTime={new Date(event.at).toISOString()}>{timeOf(event.at)}</time>
                  </li>
                ))}
              </ol>
            ) : <p>Aún no se detectó un entorno blue-green.</p>}
          </div>
          <div className="bg-demo__instructions">
            <span>Prueba local</span>
            <h2>Cambiá el destino</h2>
            <p>Con esta página abierta, ejecutá el switch desde la raíz del proyecto. La vista reflejará el cambio en la siguiente lectura.</p>
            <code>./infrastructure/scripts/switch-env.sh green</code>
            <code>./infrastructure/scripts/switch-env.sh blue</code>
            <small>Consulta la web y la API cada 1,8 segundos. Los cambios muestran tráfico real, no una animación simulada.</small>
          </div>
        </section>

        {snapshot && snapshot.failedEndpoints.length > 0 && (
          <p className="bg-demo__error" role="alert">
            Sin respuesta de: {snapshot.failedEndpoints.join(", ")}.
          </p>
        )}
      </main>
    </div>
  );
}
