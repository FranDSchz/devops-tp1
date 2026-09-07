import { useState, useEffect, useCallback } from "react";

interface Incident {
  id: string;
  title: string;
  service: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
}

const STATUS_FLOW: Record<Incident["status"], Incident["status"]> = {
  open: "in_progress",
  in_progress: "resolved",
  resolved: "closed",
  closed: "open",
};

const STATUS_LABELS: Record<Incident["status"], string> = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const API_BASE = "/api";

function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [title, setTitle] = useState("");
  const [service, setService] = useState("");
  const [severity, setSeverity] = useState<Incident["severity"]>("medium");
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/incidents`);
      if (!res.ok) throw new Error("Error al cargar incidentes");
      const data = await res.json();
      setIncidents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleCreate = async (e: import("react").FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || !service.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), service: service.trim(), severity }),
      });
      if (!res.ok) throw new Error("Error al crear incidente");
      setTitle("");
      setService("");
      setSeverity("medium");
      await fetchIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  };

  const handleAdvanceStatus = async (incident: Incident) => {
    const nextStatus = STATUS_FLOW[incident.status];
    try {
      const res = await fetch(`${API_BASE}/incidents/${incident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Error al actualizar incidente");
      await fetchIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/incidents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar incidente");
      await fetchIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  };

  return (
    <div className="app">
      <h1>OpsBoard</h1>

      {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}

      <form className="incident-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Servicio"
          value={service}
          onChange={(e) => setService(e.target.value)}
          required
        />
        <select value={severity} onChange={(e) => setSeverity(e.target.value as Incident["severity"])}>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="critical">Critica</option>
        </select>
        <button type="submit">Crear</button>
      </form>

      <div className="incident-list">
        {incidents.length === 0 && (
          <p className="empty">No hay incidentes registrados.</p>
        )}
        {incidents.map((incident) => (
          <div key={incident.id} className="incident-card">
            <div className="info">
              <div className="title">{incident.title}</div>
              <div className="meta">
                {incident.service} &middot;{" "}
                <span className={`severity severity-${incident.severity}`}>
                  {incident.severity}
                </span>{" "}
                &middot;{" "}
                <span className={`status status-${incident.status}`}>
                  {STATUS_LABELS[incident.status]}
                </span>
              </div>
              <div className="meta">
                Creado: {new Date(incident.createdAt).toLocaleString("es-AR")}
              </div>
            </div>
            <div className="actions">
              <button onClick={() => handleAdvanceStatus(incident)}>
                {STATUS_LABELS[STATUS_FLOW[incident.status]]}
              </button>
              <button className="danger" onClick={() => handleDelete(incident.id)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
