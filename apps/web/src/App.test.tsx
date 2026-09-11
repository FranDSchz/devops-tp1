import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import App from "./App";

const mockIncidents = [
  {
    id: "1",
    title: "Falla pagos",
    service: "payments",
    severity: "high",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const fetchStub = vi.fn();

beforeEach(() => {
  fetchStub.mockReset();
  global.fetch = fetchStub;
});

describe("App", () => {
  it("shows the empty state when there are no incidents", async () => {
    fetchStub.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<App />);
    expect(await screen.findByText("No hay incidentes registrados.")).toBeTruthy();
  });

  it("renders incidents fetched from the API", async () => {
    fetchStub.mockResolvedValue({
      ok: true,
      json: async () => mockIncidents,
    });

    render(<App />);
    expect(await screen.findByText("Falla pagos")).toBeTruthy();
    expect(screen.getByText((content) => content.includes("payments"))).toBeTruthy();
  });

  it("creates an incident through the API", async () => {
    fetchStub
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockIncidents });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("Titulo"), {
      target: { value: "Nuevo incidente" },
    });
    fireEvent.change(screen.getByPlaceholderText("Servicio"), {
      target: { value: "api" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      const createCall = fetchStub.mock.calls.find(
        (c) => c[1] && c[1].method === "POST"
      );
      expect(createCall).toBeTruthy();
      const body = JSON.parse(createCall![1].body);
      expect(body.title).toBe("Nuevo incidente");
      expect(body.service).toBe("api");
    });
  });

  it("deletes an incident through the API", async () => {
    fetchStub
      .mockResolvedValueOnce({ ok: true, json: async () => mockIncidents })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<App />);
    expect(await screen.findByText("Falla pagos")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);

    await waitFor(() => {
      const deleteCall = fetchStub.mock.calls.find(
        (c) => c[1] && c[1].method === "DELETE"
      );
      expect(deleteCall).toBeTruthy();
    });
  });

  it("shows which web and api instances served the page", async () => {
    fetchStub.mockImplementation((url: string) => {
      if (url.includes("instance.json")) {
        return Promise.resolve({ ok: true, json: async () => ({ instance: "web-2" }) });
      }
      if (url === "/health") {
        return Promise.resolve({ ok: true, json: async () => ({ status: "ok", instance: "api-3" }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<App />);
    expect(await screen.findByText("Web web-2 · API api-3")).toBeTruthy();
  });
});
