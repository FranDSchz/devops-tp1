import type { FastifyInstance } from "fastify";
import {
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  deleteIncident,
} from "../store/incidents.js";
import type { CreateIncidentBody, UpdateIncidentBody } from "../types/incident.js";

export async function incidentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/incidents", async (_req, reply) => {
    const incidents = await listIncidents();
    return reply.send(incidents);
  });

  app.get<{ Params: { id: string } }>(
    "/api/incidents/:id",
    async (req, reply) => {
      const incident = await getIncident(req.params.id);
      if (!incident) {
        return reply.code(404).send({ error: "Incidente no encontrado" });
      }
      return reply.send(incident);
    }
  );

  app.post<{ Body: CreateIncidentBody }>(
    "/api/incidents",
    async (req, reply) => {
      const { title, service, severity } = req.body;
      if (!title || !service || !severity) {
        return reply
          .code(400)
          .send({ error: "title, service and severity are required" });
      }
      const validSeverities = ["low", "medium", "high", "critical"];
      if (!validSeverities.includes(severity)) {
        return reply.code(400).send({ error: "Severidad inválida" });
      }
      const incident = await createIncident({ title, service, severity });
      return reply.code(201).send(incident);
    }
  );

  app.patch<{ Params: { id: string }; Body: UpdateIncidentBody }>(
    "/api/incidents/:id",
    async (req, reply) => {
      const { title, service, severity, status } = req.body;
      if (status !== undefined) {
        const validStatuses = [
          "open",
          "in_progress",
          "resolved",
          "closed",
        ];
        if (!validStatuses.includes(status)) {
          return reply.code(400).send({ error: "Invalid status" });
        }
      }
      if (severity !== undefined) {
        const validSeverities = ["low", "medium", "high", "critical"];
        if (!validSeverities.includes(severity)) {
          return reply.code(400).send({ error: "Invalid severity" });
        }
      }
      const updated = await updateIncident(req.params.id, {
        title,
        service,
        severity,
        status,
      });
      if (!updated) {
        return reply.code(404).send({ error: "Incidente no encontrado" });
      }
      return reply.send(updated);
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/incidents/:id",
    async (req, reply) => {
      const deleted = await deleteIncident(req.params.id);
      if (!deleted) {
        return reply.code(404).send({ error: "Incidente no encontrado" });
      }
      return reply.code(204).send();
    }
  );
}
