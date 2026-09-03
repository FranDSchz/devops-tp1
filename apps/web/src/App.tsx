import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createIncident,
  deleteIncident,
  listIncidents,
  updateIncidentStatus,
} from "./api/incidents";
import type { Incident, IncidentStatus, Severity } from "./types/incident";

const STATUS_FLOW: Record<IncidentStatus, IncidentStatus | null> = {
  open: "in_progress",
  in_progress: "resolved",
  resolved: "closed",
  closed: null,
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [title, setTitle] = useState("");
  const [service, setService] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingIncidentId, setPendingIncidentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      setIncidents(await listIncidents());
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIncidents();
  }, [fetchIncidents]);

  const summary = useMemo(
    () => ({
      total: incidents.length,
      active: incidents.filter(({ status }) => status === "open" || status === "in_progress")
        .length,
      critical: incidents.filter(
        ({ severity: incidentSeverity, status }) =>
          incidentSeverity === "critical" && status !== "closed",
      ).length,
      completed: incidents.filter(({ status }) => status === "resolved" || status === "closed")
        .length,
    }),
    [incidents],
  );

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const normalizedService = service.trim();

    if (!normalizedTitle || !normalizedService || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const createdIncident = await createIncident({
        title: normalizedTitle,
        service: normalizedService,
        severity,
      });
      setIncidents((current) => [createdIncident, ...current]);
      setTitle("");
      setService("");
      setSeverity("medium");
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceStatus = async (incident: Incident) => {
    const nextStatus = STATUS_FLOW[incident.status];
    if (!nextStatus || pendingIncidentId) return;

    setPendingIncidentId(incident.id);
    try {
      const updatedIncident = await updateIncidentStatus(incident.id, nextStatus);
      setIncidents((current) =>
        current.map((item) => (item.id === updatedIncident.id ? updatedIncident : item)),
      );
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingIncidentId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (pendingIncidentId) return;

    setPendingIncidentId(id);
    try {
      await deleteIncident(id);
      setIncidents((current) => current.filter((incident) => incident.id !== id));
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingIncidentId(null);
    }
  };

  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero__eyebrow">
          <span className="live-dot" aria-hidden="true" />
          Centro de operaciones
        </div>
        <div className="hero__content">
          <div>
            <h1>OpsBoard</h1>
            <p>Registrá, priorizá y seguí incidentes desde un único tablero.</p>
          </div>
          <div className="api-state" title="La interfaz consume la API REST de OpsBoard">
            <span>Integración API</span>
            <strong>REST + Redis</strong>
          </div>
        </div>
      </header>

      <main>
        <section className="summary-grid" aria-label="Resumen de incidentes">
          <SummaryCard label="Total" value={summary.total} tone="neutral" />
          <SummaryCard label="Activos" value={summary.active} tone="blue" />
          <SummaryCard label="Críticos" value={summary.critical} tone="red" />
          <SummaryCard label="Resueltos" value={summary.completed} tone="green" />
        </section>

        {error && (
          <div className="alert" role="alert">
            <div>
              <strong>No pudimos completar la operación</strong>
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => void fetchIncidents()}>
              Reintentar
            </button>
          </div>
        )}

        <section className="panel create-panel" aria-labelledby="create-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Nuevo registro</span>
              <h2 id="create-title">Reportar un incidente</h2>
            </div>
            <span className="required-note">Todos los campos son obligatorios</span>
          </div>

          <form className="incident-form" onSubmit={handleCreate}>
            <label>
              <span>Título</span>
              <input
                type="text"
                name="title"
                placeholder="Ej. Error al procesar pagos"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                disabled={isSubmitting}
                required
              />
            </label>
            <label>
              <span>Servicio afectado</span>
              <input
                type="text"
                name="service"
                placeholder="Ej. payments-api"
                value={service}
                onChange={(event) => setService(event.target.value)}
                maxLength={80}
                disabled={isSubmitting}
                required
              />
            </label>
            <label>
              <span>Severidad</span>
              <select
                name="severity"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as Severity)}
                disabled={isSubmitting}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              <span aria-hidden="true">+</span>
              {isSubmitting ? "Creando…" : "Crear incidente"}
            </button>
          </form>
        </section>

        <section className="incidents-section" aria-labelledby="incidents-title">
          <div className="section-heading section-heading--list">
            <div>
              <span className="section-kicker">Seguimiento</span>
              <h2 id="incidents-title">Incidentes recientes</h2>
            </div>
            <button
              className="refresh-button"
              type="button"
              onClick={() => void fetchIncidents()}
              disabled={isLoading}
            >
              {isLoading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          {isLoading ? (
            <div className="panel state-panel" role="status">
              <span className="loader" aria-hidden="true" />
              <strong>Cargando incidentes…</strong>
              <span>Consultando la API de OpsBoard.</span>
            </div>
          ) : incidents.length === 0 ? (
            <div className="panel state-panel empty-state">
              <span className="empty-state__icon" aria-hidden="true">✓</span>
              <strong>No hay incidentes registrados</strong>
              <span>Cuando reportes uno, aparecerá en este tablero.</span>
            </div>
          ) : (
            <div className="incident-list">
              {incidents.map((incident) => {
                const nextStatus = STATUS_FLOW[incident.status];
                const isPending = pendingIncidentId === incident.id;

                return (
                  <article key={incident.id} className="incident-card">
                    <div className={`severity-marker severity-marker--${incident.severity}`} />
                    <div className="incident-card__body">
                      <div className="incident-card__header">
                        <div>
                          <h3>{incident.title}</h3>
                          <p className="service-name">{incident.service}</p>
                        </div>
                        <div className="badges">
                          <span className={`badge badge--severity-${incident.severity}`}>
                            {SEVERITY_LABELS[incident.severity]}
                          </span>
                          <span className={`badge badge--status-${incident.status}`}>
                            {STATUS_LABELS[incident.status]}
                          </span>
                        </div>
                      </div>

                      <div className="incident-card__footer">
                        <time dateTime={incident.createdAt}>
                          Creado {formatDate(incident.createdAt)}
                        </time>
                        <div className="actions">
                          {nextStatus && (
                            <button
                              type="button"
                              onClick={() => void handleAdvanceStatus(incident)}
                              disabled={pendingIncidentId !== null}
                            >
                              {isPending ? "Guardando…" : `Mover a ${STATUS_LABELS[nextStatus]}`}
                            </button>
                          )}
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => void handleDelete(incident.id)}
                            disabled={pendingIncidentId !== null}
                            aria-label={`Eliminar ${incident.title}`}
                          >
                            {isPending ? "Procesando…" : "Eliminar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>OpsBoard · UTN FRRe</span>
        <span>Aplicación web contenerizada</span>
      </footer>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  tone: "neutral" | "blue" | "red" | "green";
}

function SummaryCard({ label, value, tone }: SummaryCardProps) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "en una fecha desconocida";

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default App;
