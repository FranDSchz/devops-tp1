import type { Fleet, InstanceInfo, Readiness } from "../types/instance";

interface InstancePanelProps {
  fleet: Fleet | null;
  readiness: Readiness | null;
  webInstance: string | null;
  isLoading: boolean;
  lastUpdatedMs: number | null;
  onRefresh: () => void;
}

export function InstancePanel({
  fleet,
  readiness,
  webInstance,
  isLoading,
  lastUpdatedMs,
  onRefresh,
}: InstancePanelProps) {
  const instances = fleet?.instances ?? [];
  const expected = fleet?.expected ?? 0;
  const isRedisUp = readiness?.redis === "ok";
  const isDegraded = instances.length < expected;

  return (
    <section className="instance-panel" aria-label="Estado de las instancias del servicio">
      <div className="instance-panel__header">
        <div>
          <span className="section-kicker">Topología en vivo</span>
          <h2 className="instance-panel__title">Réplicas del servicio</h2>
        </div>
        <div className="instance-panel__meta">
          <span
            className={`status-pill ${isRedisUp ? "status-pill--up" : "status-pill--down"}`}
            title={isRedisUp ? "Redis respondió PONG" : "Redis no respondió al ping de readiness"}
          >
            <span className="status-pill__dot" aria-hidden="true" />
            Redis {isRedisUp ? "conectado" : "sin respuesta"}
          </span>
          <span className="instance-panel__timestamp">
            {lastUpdatedMs ? `Actualizado ${formatClock(lastUpdatedMs)}` : "Consultando…"}
          </span>
          <button
            className="refresh-button"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="fleet-summary">
        <span className={`fleet-summary__count ${isDegraded ? "fleet-summary__count--down" : ""}`}>
          <strong>{instances.length}</strong> / {expected} réplicas API en línea
        </span>
        {isDegraded && (
          <span className="fleet-summary__alert" role="status">
            Replica caída: Nginx sigue respondiendo con las réplicas disponibles.
          </span>
        )}
      </div>

      {instances.length === 0 ? (
        <p className="instance-panel__empty">
          {isLoading
            ? "Consultando el registro de instancias…"
            : "Sin instancias registradas. El registro se alimenta de los latidos enviados a Redis."}
        </p>
      ) : (
        <ul className="replica-grid">
          {instances.map((instance) => (
            <ReplicaCard
              key={instance.id}
              instance={instance}
              isServing={instance.id === fleet?.servedBy}
            />
          ))}
        </ul>
      )}

      <div className="web-replica">
        <div>
          <span className="web-replica__label">Réplica web que sirvió esta página</span>
          <strong className="web-replica__id">{webInstance ?? "desconocida"}</strong>
        </div>
        <p className="web-replica__note">
          Los contenedores web no registran latido porque no ejecutan Node; su identidad se
          publica en <code>/instance.json</code>.
        </p>
      </div>
    </section>
  );
}

interface ReplicaCardProps {
  instance: InstanceInfo;
  isServing: boolean;
}

function ReplicaCard({ instance, isServing }: ReplicaCardProps) {
  return (
    <li className={`replica-card ${isServing ? "replica-card--active" : ""}`}>
      <div className="replica-card__head">
        <span className="replica-card__role">API</span>
        {isServing && <span className="replica-card__serving">sirviendo tu sesión</span>}
      </div>
      <strong className="replica-card__id">{instance.id}</strong>
      <dl className="replica-card__stats">
        <div>
          <dt>Uptime</dt>
          <dd>{formatDuration(instance.uptimeSeconds)}</dd>
        </div>
        <div>
          <dt>Memoria RSS</dt>
          <dd>{formatBytes(instance.memoryRss)}</dd>
        </div>
        <div>
          <dt>Nodo</dt>
          <dd title={instance.node}>{truncate(instance.node, 14)}</dd>
        </div>
        <div>
          <dt>Versión</dt>
          <dd>{instance.nodeVersion}</dd>
        </div>
      </dl>
    </li>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const megabytes = bytes / 1024 / 1024;
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(2)} GB` : `${megabytes.toFixed(1)} MB`;
}

function formatClock(timestampMs: number): string {
  return new Intl.DateTimeFormat("es-AR", { timeStyle: "medium" }).format(new Date(timestampMs));
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
