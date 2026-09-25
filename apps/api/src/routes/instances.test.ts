import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/redis.js", () => ({
  getRedis: vi.fn(() => ({ ping: vi.fn().mockResolvedValue("PONG") })),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../store/instances.js", () => ({
  listLiveInstances: vi.fn(),
  getExpectedInstances: vi.fn(() => 3),
  getInstanceId: vi.fn(() => process.env.INSTANCE_ID ?? "test-instance"),
  getProcessStartedAtMs: vi.fn(() => Date.now() - 60_000),
  registerHeartbeat: vi.fn().mockResolvedValue(undefined),
  HEARTBEAT_INTERVAL_MS: 5000,
  HEARTBEAT_TTL_MS: 15000,
}));

import { buildApp } from "../index.js";
import { listLiveInstances } from "../store/instances.js";
import type { InstanceInfo } from "../types/instance.js";

function buildInstance(id: string, overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    id,
    role: "api",
    startedAt: "2026-01-01T12:00:00.000Z",
    startedAtMs: Date.UTC(2026, 0, 1, 12, 0, 0),
    uptimeSeconds: 120,
    memoryRss: 52428800,
    heapUsed: 12582912,
    node: "opsboard-node",
    nodeVersion: "v22.11.0",
    pid: 42,
    lastSeenMs: Date.UTC(2026, 0, 1, 12, 5, 0),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INSTANCE_ID = "api-2";
  process.env.FLEET_SIZE = "3";
});

describe("GET /api/instances", () => {
  it("returns the live fleet with the responding instance as servedBy", async () => {
    vi.mocked(listLiveInstances).mockResolvedValue([
      buildInstance("api-1"),
      buildInstance("api-2"),
      buildInstance("api-3"),
    ]);

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/instances" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.servedBy).toBe("api-2");
    expect(body.count).toBe(3);
    expect(body.expected).toBe(3);
    expect(body.heartbeatTtlMs).toBe(15000);
    expect(body.instances).toHaveLength(3);
    expect(body.instances[0]).toMatchObject({ id: "api-1", role: "api", uptimeSeconds: 120 });
    expect(res.headers["x-instance-id"]).toBe("api-2");
    await app.close();
  });

  it("returns 200 with an empty list when every replica expired", async () => {
    vi.mocked(listLiveInstances).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/instances" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ count: 0, instances: [] });
    await app.close();
  });

  it("returns 503 when the registry cannot be read", async () => {
    vi.mocked(listLiveInstances).mockRejectedValue(new Error("redis down"));

    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/instances" });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toHaveProperty("error");
    await app.close();
  });
});

describe("diagnostic endpoints", () => {
  it("exposes runtime metrics on /health", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instance).toBe("api-2");
    expect(body.startedAt).toBeTruthy();
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.memoryRss).toBeGreaterThan(0);
    await app.close();
  });
});
