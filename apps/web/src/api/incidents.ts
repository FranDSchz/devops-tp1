import type {
  CreateIncidentInput,
  Incident,
  IncidentStatus,
} from "../types/incident";

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";
const API_BASE = configuredApiBase.replace(/\/$/, "");

export function listIncidents(): Promise<Incident[]> {
  return request<Incident[]>("/incidents");
}

export function createIncident(input: CreateIncidentInput): Promise<Incident> {
  return request<Incident>("/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
  return request<Incident>(`/incidents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function deleteIncident(id: string): Promise<void> {
  return request<void>(`/incidents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error("No se pudo conectar con la API. Verificá que el backend esté disponible.");
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // The API may return an empty or non-JSON error response.
  }

  return `La API respondió con el código ${response.status}.`;
}
