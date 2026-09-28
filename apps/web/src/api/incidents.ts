import type {
  CreateIncidentInput,
  Incident,
  IncidentStatus,
} from "../types/incident";
import { apiRequest } from "./client";

export function listIncidents(): Promise<Incident[]> {
  return apiRequest<Incident[]>("/incidents");
}

export function createIncident(input: CreateIncidentInput): Promise<Incident> {
  return apiRequest<Incident>("/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
  return apiRequest<Incident>(`/incidents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function deleteIncident(id: string): Promise<void> {
  return apiRequest<void>(`/incidents/${encodeURIComponent(id)}`, { method: "DELETE" });
}
