import type { FastifyInstance } from "fastify";
import { assignIncident } from "../store/assignment.js";

// Registered only with RACE_DEMO_ENABLED=true; never enabled in normal stacks.
export async function assignmentDemoRoutes(app: FastifyInstance): Promise<void> {
  for (const mode of ["vulnerable", "protected"] as const) {
    app.post<{ Params: { id: string }; Body: { responsible: string } }>(
      `/api/demo/incidents/:id/assign/${mode}`,
      {
        preValidation: async (req, reply) => {
          if (typeof req.body?.responsible !== "string") {
            return reply.code(400).send({ error: "responsible must be a string" });
          }
        },
        schema: {
          body: {
            type: "object", required: ["responsible"], additionalProperties: false,
            properties: { responsible: { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" } },
          },
        },
      },
      async (req, reply) => {
        const result = await assignIncident(req.params.id, req.body.responsible, mode);
        const status = result === "not-found" ? 404 : result === "conflict" ? 409 : 200;
        return reply.code(status).send({ result, responsible: req.body.responsible, mode });
      },
    );
  }
}
