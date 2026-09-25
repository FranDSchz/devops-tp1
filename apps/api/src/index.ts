import Fastify from "fastify";
import { fileURLToPath } from "node:url";
import { incidentRoutes } from "./routes/incidents.js";
import { instanceRoutes } from "./routes/instances.js";
import {
  getInstanceId,
  getProcessStartedAtMs,
  HEARTBEAT_INTERVAL_MS,
  registerHeartbeat,
} from "./store/instances.js";
import { closeRedis, getRedis } from "./store/redis.js";

type InstanceTimer = ReturnType<typeof setInterval>;

function runtimeInfo() {
  return {
    instance: getInstanceId(),
    startedAt: new Date(getProcessStartedAtMs()).toISOString(),
    uptimeSeconds: Math.floor((Date.now() - getProcessStartedAtMs()) / 1000),
    memoryRss: process.memoryUsage().rss,
  };
}

export function buildApp() {
  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (req, reply) => {
    reply.header("X-Instance-ID", getInstanceId());
  });

  app.get("/health", async () => {
    return { status: "ok", ...runtimeInfo() };
  });

  app.get("/ready", async (_req, reply) => {
    try {
      await getRedis().ping();
      return reply.send({ status: "ok", redis: "ok", ...runtimeInfo() });
    } catch {
      return reply
        .code(503)
        .send({ status: "not-ready", redis: "unreachable", ...runtimeInfo() });
    }
  });

  app.get("/whoami", async () => {
    return { instance: getInstanceId() };
  });

  app.register(incidentRoutes);
  app.register(instanceRoutes);

  return app;
}

function startHeartbeat(): InstanceTimer {
  const timer = setInterval(() => {
    void registerHeartbeat(getInstanceId()).catch((err) => {
      console.error("heartbeat registration failed", err);
    });
  }, HEARTBEAT_INTERVAL_MS);
  timer.unref();
  return timer;
}

export async function startServer() {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const heartbeat = startHeartbeat();
  await registerHeartbeat(getInstanceId()).catch((err) => {
    app.log.error(err);
  });
  process.on("SIGTERM", async () => {
    clearInterval(heartbeat);
    await app.close();
    await closeRedis();
  });
  try {
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`API running on port ${port} (instance ${getInstanceId()})`);
  } catch (err) {
    app.log.error(err);
    clearInterval(heartbeat);
    await closeRedis();
    process.exit(1);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  await startServer();
}
