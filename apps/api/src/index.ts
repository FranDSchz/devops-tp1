import Fastify from "fastify";
import { incidentRoutes } from "./routes/incidents.js";
import { closeRedis } from "./store/redis.js";

const INSTANCE_ID = process.env.INSTANCE_ID ?? process.pid.toString();

const app = Fastify({ logger: true });

app.addHook("onResponse", async (req, reply) => {
  reply.header("X-Instance-ID", INSTANCE_ID);
});

app.get("/health", async () => {
  return { status: "ok", instance: INSTANCE_ID };
});

app.get("/whoami", async () => {
  return { instance: INSTANCE_ID };
});

await app.register(incidentRoutes);

const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API running on port ${port} (instance ${INSTANCE_ID})`);
} catch (err) {
  app.log.error(err);
  await closeRedis();
  process.exit(1);
}

process.on("SIGTERM", async () => {
  await app.close();
  await closeRedis();
});
