import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import type { Incident } from "./types/incident";

const mockIncident: Incident = {
  id: "incident-1",
  title: "Falla en pagos",
  service: "payments-api",
  severity: "high",
  status: "open",
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
};

const fetchStub = vi.fn();

beforeEach(() => {
  fetchStub.mockReset();
  vi.stubGlobal("fetch", fetchStub);
});

describe("OpsBoard", () => {
  it("loads incidents from the backend API and updates the summary", async () => {
    fetchStub.mockResolvedValue(response([mockIncident]));

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando incidentes");
    expect(await screen.findByText("Falla en pagos")).toBeInTheDocument();
    expect(screen.getByText("payments-api")).toBeInTheDocument();
    expect(screen.getByLabelText("Resumen de incidentes")).toHaveTextContent("Total1");
    expect(fetchStub).toHaveBeenCalledWith("/api/incidents", undefined);
  });

  it("shows the empty state when the API has no incidents", async () => {
    fetchStub.mockResolvedValue(response([]));

    render(<App />);

    expect(await screen.findByText("No hay incidentes registrados")).toBeInTheDocument();
  });

  it("creates an incident and renders the API response", async () => {
    const createdIncident: Incident = {
      ...mockIncident,
      id: "incident-2",
      title: "Latencia elevada",
      service: "gateway",
      severity: "critical",
    };
    fetchStub
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(createdIncident, 201));

    render(<App />);
    await screen.findByText("No hay incidentes registrados");

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "  Latencia elevada  " },
    });
    fireEvent.change(screen.getByLabelText("Servicio afectado"), {
      target: { value: " gateway " },
    });
    fireEvent.change(screen.getByLabelText("Severidad"), {
      target: { value: "critical" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear incidente" }));

    expect(await screen.findByText("Latencia elevada")).toBeInTheDocument();
    expect(fetchStub).toHaveBeenLastCalledWith("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Latencia elevada",
        service: "gateway",
        severity: "critical",
      }),
    });
  });

  it("moves an incident to its next status", async () => {
    const updatedIncident: Incident = {
      ...mockIncident,
      status: "in_progress",
      updatedAt: "2026-01-01T12:05:00.000Z",
    };
    fetchStub
      .mockResolvedValueOnce(response([mockIncident]))
      .mockResolvedValueOnce(response(updatedIncident));

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Mover a En progreso" }));

    await waitFor(() => {
      expect(fetchStub).toHaveBeenLastCalledWith("/api/incidents/incident-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
    });
    expect(await screen.findByText("En progreso")).toBeInTheDocument();
  });

  it("deletes an incident from the API and the screen", async () => {
    fetchStub
      .mockResolvedValueOnce(response([mockIncident]))
      .mockResolvedValueOnce(response(undefined, 204));

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar Falla en pagos" }));

    await waitFor(() => {
      expect(fetchStub).toHaveBeenLastCalledWith("/api/incidents/incident-1", {
        method: "DELETE",
      });
    });
    expect(await screen.findByText("No hay incidentes registrados")).toBeInTheDocument();
  });

  it("shows the backend error and can retry the request", async () => {
    fetchStub
      .mockResolvedValueOnce(response({ error: "Redis unavailable" }, 503))
      .mockResolvedValueOnce(response([]));

    render(<App />);

    expect(await screen.findByText("Redis unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Redis unavailable")).not.toBeInTheDocument());
  });
});

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}
