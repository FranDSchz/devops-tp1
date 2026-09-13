import { describe, it, expect, afterEach, vi } from "vitest";

type FakeStore = Record<string, Record<string, string>>;

const state = {
  data: {} as FakeStore,
  index: [] as string[],
};

function resetState() {
  state.data = {};
  state.index = [];
}

function createRedisMock() {
  const queued: Array<() => [Error | null, unknown]> = [];

  const command = {
    hset: async (key: string, obj: Record<string, string>) => {
      state.data[key] = { ...(state.data[key] ?? {}), ...obj };
      return 1;
    },
    hgetall: async (key: string) => state.data[key] ?? {},
    sadd: async (key: string, member: string) => {
      if (key === "incidents" && !state.index.includes(member))
        state.index.push(member);
      return 1;
    },
    smembers: async () => state.index,
    exists: async (key: string) => (state.data[key] ? 1 : 0),
    del: async (key: string) => {
      const had = !!state.data[key];
      delete state.data[key];
      return had ? 1 : 0;
    },
    srem: async (key: string, member: string) => {
      if (key === "incidents")
        state.index = state.index.filter((m) => m !== member);
      return 1;
    },
  };

  const pipeline = async (ops: Array<[string, string, unknown]>) => {
    return Promise.all(
      ops.map(async ([op, key, arg]) => {
        if (op === "hset") {
          await command.hset(key, arg as Record<string, string>);
          return [null, 1] as [Error | null, unknown];
        }
        if (op === "sadd") {
          await command.sadd(key, arg as string);
          return [null, 1] as [Error | null, unknown];
        }
        if (op === "del") {
          await command.del(key);
          return [null, 1] as [Error | null, unknown];
        }
        if (op === "srem") {
          await command.srem(key, arg as string);
          return [null, 1] as [Error | null, unknown];
        }
        if (op === "hgetall") {
          const res = await command.hgetall(key);
          return [null, res] as [Error | null, unknown];
        }
        return [null, null] as [Error | null, unknown];
      })
    );
  };

  return {
    ...command,
    pipeline: () => {
      const ops: Array<[string, string, unknown]> = [];
      const proxy = {
        hset: (k: string, v: Record<string, string>) => {
          ops.push(["hset", k, v]);
          return proxy;
        },
        sadd: (k: string, v: string) => {
          ops.push(["sadd", k, v]);
          return proxy;
        },
        del: (k: string) => {
          ops.push(["del", k, "x"]);
          return proxy;
        },
        srem: (k: string, v: string) => {
          ops.push(["srem", k, v]);
          return proxy;
        },
        hgetall: (k: string) => {
          ops.push(["hgetall", k, "x"]);
          return proxy;
        },
        exec: () => pipeline(ops),
      };
      return proxy;
    },
    quit: async () => "OK",
  };
}

vi.mock("ioredis", () => {
  const Redis = vi.fn(() => createRedisMock());
  return { Redis };
});

import { createIncident, listIncidents, getIncident, updateIncident, deleteIncident } from "./incidents.js";
import { closeRedis } from "./redis.js";

describe("incident store (with mocked redis)", () => {
  afterEach(async () => {
    resetState();
    await closeRedis();
    vi.clearAllMocks();
  });

  it("creates an incident with default open status", async () => {
    const incident = await createIncident({
      title: "Falla API",
      service: "payments",
      severity: "high",
    });

    expect(incident.id).toBeTruthy();
    expect(incident.title).toBe("Falla API");
    expect(incident.service).toBe("payments");
    expect(incident.severity).toBe("high");
    expect(incident.status).toBe("open");
    expect(incident.createdAt).toBeTruthy();
    expect(incident.updatedAt).toBe(incident.createdAt);
  });

  it("lists all incidents", async () => {
    await createIncident({ title: "A", service: "web", severity: "low" });
    await createIncident({ title: "B", service: "db", severity: "critical" });

    const list = await listIncidents();
    expect(list).toHaveLength(2);
    const titles = list.map((i) => i.title);
    expect(titles).toContain("A");
    expect(titles).toContain("B");
  });

  it("gets a single incident by id", async () => {
    const created = await createIncident({ title: "Solo", service: "cache", severity: "medium" });
    const found = await getIncident(created.id);
    expect(found?.title).toBe("Solo");
  });

  it("returns null for an unknown incident", async () => {
    const found = await getIncident("no-existe");
    expect(found).toBeNull();
  });

  it("updates only provided fields", async () => {
    const created = await createIncident({ title: "Original", service: "api", severity: "low" });

    const updated = await updateIncident(created.id, { status: "in_progress" });
    expect(updated?.status).toBe("in_progress");
    expect(updated?.title).toBe("Original");
    expect(updated?.service).toBe("api");
    expect(updated?.severity).toBe("low");
    expect(updated?.updatedAt).not.toBe(created.updatedAt);
  });

  it("returns null when updating an unknown incident", async () => {
    const updated = await updateIncident("no-existe", { status: "closed" });
    expect(updated).toBeNull();
  });

  it("deletes an incident", async () => {
    const created = await createIncident({ title: "Temporal", service: "web", severity: "high" });
    expect(await getIncident(created.id)).not.toBeNull();
    expect(await deleteIncident(created.id)).toBe(true);
    expect(await getIncident(created.id)).toBeNull();
  });
});
