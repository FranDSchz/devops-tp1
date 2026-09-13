import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../store/redis.js", () => ({
  getRedis: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue("PONG"),
  })),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../store/incidents.js", () => ({
  listIncidents: vi.fn(),
  getIncident: vi.fn(),
  createIncident: vi.fn(),
  updateIncident: vi.fn(),
  deleteIncident: vi.fn(),
}));

import { buildApp } from "../index.js";
import {
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  deleteIncident,
} from "../store/incidents.js";
import type { Incident } from "../types/incident.js";

const mockIncident: Incident = {
  id: "test-uuid-1",
  title: "Fallo de conexion",
  service: "database",
  severity: "high",
  status: "open",
  createdAt: "2026-09-13T12:00:00.000Z",
  updatedAt: "2026-09-13T12:00:00.000Z",
};

describe("Incident Routes & System Endpoints", () => {
  const app = buildApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("System Endpoints & Headers", () => {
    it("injects X-Instance-ID header on responses", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.headers["x-instance-id"]).toBeDefined();
    });

    it("GET /health returns 200 with status ok and instance", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe("ok");
      expect(body.instance).toBeDefined();
    });

    it("GET /whoami returns 200 with instance id", async () => {
      const res = await app.inject({ method: "GET", url: "/whoami" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty("instance");
    });
  });

  describe("GET /api/incidents", () => {
    it("returns 200 with incident list", async () => {
      vi.mocked(listIncidents).mockResolvedValue([mockIncident]);

      const res = await app.inject({ method: "GET", url: "/api/incidents" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([mockIncident]);
    });
  });

  describe("GET /api/incidents/:id", () => {
    it("returns 200 with incident when found", async () => {
      vi.mocked(getIncident).mockResolvedValue(mockIncident);

      const res = await app.inject({ method: "GET", url: "/api/incidents/test-uuid-1" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(mockIncident);
    });

    it("returns 404 when incident does not exist", async () => {
      vi.mocked(getIncident).mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: "/api/incidents/not-found" });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: "Incidente no encontrado" });
    });
  });

  describe("POST /api/incidents", () => {
    it("returns 201 and creates incident with valid payload", async () => {
      vi.mocked(createIncident).mockResolvedValue(mockIncident);

      const res = await app.inject({
        method: "POST",
        url: "/api/incidents",
        payload: {
          title: "Fallo de conexion",
          service: "database",
          severity: "high",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual(mockIncident);
      expect(createIncident).toHaveBeenCalledWith({
        title: "Fallo de conexion",
        service: "database",
        severity: "high",
      });
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/incidents",
        payload: { title: "Falta servicio y severidad" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({
        error: "title, service and severity are required",
      });
      expect(createIncident).not.toHaveBeenCalled();
    });

    it("returns 400 when severity is invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/incidents",
        payload: {
          title: "Test",
          service: "api",
          severity: "super-critical",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Severidad inválida" });
      expect(createIncident).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/incidents/:id", () => {
    it("returns 200 with updated incident when payload is valid", async () => {
      const updated = { ...mockIncident, status: "resolved" as const };
      vi.mocked(updateIncident).mockResolvedValue(updated);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/incidents/test-uuid-1",
        payload: { status: "resolved" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(updated);
      expect(updateIncident).toHaveBeenCalledWith("test-uuid-1", { status: "resolved" });
    });

    it("returns 400 when status is invalid", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/incidents/test-uuid-1",
        payload: { status: "invalido" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Invalid status" });
      expect(updateIncident).not.toHaveBeenCalled();
    });

    it("returns 400 when severity is invalid", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/incidents/test-uuid-1",
        payload: { severity: "invalid-sev" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Invalid severity" });
      expect(updateIncident).not.toHaveBeenCalled();
    });

    it("returns 404 when updating a non-existent incident", async () => {
      vi.mocked(updateIncident).mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/incidents/not-found",
        payload: { status: "closed" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: "Incidente no encontrado" });
    });
  });

  describe("DELETE /api/incidents/:id", () => {
    it("returns 204 when incident is deleted successfully", async () => {
      vi.mocked(deleteIncident).mockResolvedValue(true);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/incidents/test-uuid-1",
      });

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe("");
    });

    it("returns 404 when deleting a non-existent incident", async () => {
      vi.mocked(deleteIncident).mockResolvedValue(false);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/incidents/not-found",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: "Incidente no encontrado" });
    });
  });
});
