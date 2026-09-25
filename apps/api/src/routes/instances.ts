import type { FastifyInstance } from "fastify";
import {
  getExpectedInstances,
  getInstanceId,
  HEARTBEAT_TTL_MS,
  listLiveInstances,
} from "../store/instances.js";
import type { FleetResponse } from "../types/instance.js";

export async function instanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/instances", async (_req, reply) => {
    try {
      const instances = await listLiveInstances();
      const body: FleetResponse = {
        servedBy: getInstanceId(),
        count: instances.length,
        expected: getExpectedInstances(),
        heartbeatTtlMs: HEARTBEAT_TTL_MS,
        instances,
      };
      return reply.send(body);
    } catch {
      return reply
        .code(503)
        .send({ error: "No se pudo consultar el registro de instancias" });
    }
  });
}
