import { describe, it, expect, afterEach, vi } from "vitest";

type Bound = { score: number; exclusive: boolean };
type Member = { id: string; score: number };

const state = {
  sortedSet: [] as Member[],
  hash: {} as Record<string, Record<string, string>>,
};

function resetState() {
  state.sortedSet = [];
  state.hash = {};
}

function parseBound(value: string): Bound {
  if (value === "-inf") return { score: -Infinity, exclusive: false };
  if (value === "+inf") return { score: Infinity, exclusive: false };
  const exclusive = value.startsWith("(");
  return { score: Number(exclusive ? value.slice(1) : value), exclusive };
}

function inRange(score: number, min: Bound, max: Bound): boolean {
  const aboveMin = min.exclusive ? score > min.score : score >= min.score;
  const belowMax = max.exclusive ? score < max.score : score <= max.score;
  return aboveMin && belowMax;
}

function scoreOf(id: string): number | undefined {
  return state.sortedSet.find((member) => member.id === id)?.score;
}

function setScore(id: string, score: number) {
  const member = state.sortedSet.find((item) => item.id === id);
  if (member) member.score = score;
}

function putPayload(id: string, payload: unknown) {
  state.hash["fleet:api:data"] = {
    ...(state.hash["fleet:api:data"] ?? {}),
    [id]: typeof payload === "string" ? payload : JSON.stringify(payload),
  };
}

const commands = {
  zadd: (key: string, score: number, member: string) => {
    const existing = state.sortedSet.find((item) => item.id === member);
    if (existing) existing.score = score;
    else state.sortedSet.push({ id: member, score });
    return 1;
  },
  hset: (key: string, field: string, value: string) => {
    state.hash[key] = { ...(state.hash[key] ?? {}), [field]: value };
    return 1;
  },
  hmget: (key: string, ...fields: string[]) =>
    fields.map((field) => state.hash[key]?.[field] ?? null),
  zrangebyscore: (key: string, min: string, max: string, ...options: string[]) => {
    const matches = state.sortedSet.filter((member) =>
      inRange(member.score, parseBound(min), parseBound(max)),
    );
    const withScores = options.includes("WITHSCORES");
    return matches.flatMap((member) =>
      withScores ? [member.id, String(member.score)] : [member.id],
    );
  },
  zremrangebyscore: (key: string, min: string, max: string) => {
    const bounds = [parseBound(min), parseBound(max)];
    const before = state.sortedSet.length;
    state.sortedSet = state.sortedSet.filter(
      (member) => !inRange(member.score, bounds[0], bounds[1]),
    );
    return before - state.sortedSet.length;
  },
  zrem: (key: string, ...members: string[]) => {
    state.sortedSet = state.sortedSet.filter((member) => !members.includes(member.id));
    return members.length;
  },
  hdel: (key: string, ...fields: string[]) => {
    for (const field of fields) delete state.hash[key]?.[field];
    return fields.length;
  },
  quit: async () => "OK",
};

type CommandName = keyof typeof commands;

function createRedisMock() {
  const run = (command: CommandName, args: unknown[]) =>
    (commands[command] as (...params: unknown[]) => unknown)(...args);

  const pipeline = () => {
    const ops: Array<[CommandName, unknown[]]> = [];
    const acknowledged: [Error | null, unknown] = [null, 1];
    const proxy = {
      exec: async () => {
        for (const [command, args] of ops) run(command, args);
        return ops.map(() => acknowledged);
      },
    };

    return new Proxy(proxy, {
      get: (target, property: string) => {
        if (property === "exec") return target.exec;
        return (...args: unknown[]) => {
          ops.push([property as CommandName, args]);
          return proxy;
        };
      },
    });
  };

  return { ...commands, pipeline, ping: async () => "PONG" };
}

vi.mock("ioredis", () => {
  const Redis = vi.fn(() => createRedisMock());
  return { Redis };
});

import {
  getExpectedInstances,
  HEARTBEAT_TTL_MS,
  listLiveInstances,
  registerHeartbeat,
} from "./instances.js";
import { closeRedis } from "./redis.js";

describe("instance fleet store (with mocked redis)", () => {
  afterEach(async () => {
    resetState();
    await closeRedis();
    vi.clearAllMocks();
    delete process.env.FLEET_SIZE;
  });

  it("registers a heartbeat in the sorted set and the data hash", async () => {
    await registerHeartbeat("api-1");

    expect(scoreOf("api-1")).toBeGreaterThan(0);
    const stored = JSON.parse(state.hash["fleet:api:data"]["api-1"] ?? "{}");
    expect(stored.id).toBe("api-1");
  });

  it("returns the registered instance with its runtime metrics", async () => {
    await registerHeartbeat("api-1");

    const [instance] = await listLiveInstances();

    expect(instance.id).toBe("api-1");
    expect(instance.role).toBe("api");
    expect(instance.memoryRss).toBeGreaterThan(0);
    expect(instance.heapUsed).toBeGreaterThan(0);
    expect(instance.node).toBeTruthy();
    expect(instance.nodeVersion).toBe(process.version);
    expect(instance.startedAt).toBe(new Date(instance.startedAtMs).toISOString());
  });

  it("lists every live instance sorted by id", async () => {
    await registerHeartbeat("api-3");
    await registerHeartbeat("api-1");
    await registerHeartbeat("api-2");

    const instances = await listLiveInstances();

    expect(instances.map((instance) => instance.id)).toEqual(["api-1", "api-2", "api-3"]);
  });

  it("excludes instances whose heartbeat expired and prunes them", async () => {
    await registerHeartbeat("api-1");
    await registerHeartbeat("api-2");
    setScore("api-2", Date.now() - HEARTBEAT_TTL_MS - 1000);

    const instances = await listLiveInstances();

    expect(instances.map((instance) => instance.id)).toEqual(["api-1"]);
    expect(scoreOf("api-2")).toBeUndefined();
    expect(state.hash["fleet:api:data"]["api-2"]).toBeUndefined();
  });

  it("skips and removes index entries without a stored payload", async () => {
    await registerHeartbeat("api-1");
    state.sortedSet.push({ id: "api-9", score: Date.now() });

    const instances = await listLiveInstances();

    expect(instances.map((instance) => instance.id)).toEqual(["api-1"]);
    expect(scoreOf("api-9")).toBeUndefined();
  });

  it("treats a corrupted payload as a missing entry", async () => {
    await registerHeartbeat("api-1");
    putPayload("api-2", "{not-json");
    state.sortedSet.push({ id: "api-2", score: Date.now() });

    const instances = await listLiveInstances();

    expect(instances.map((instance) => instance.id)).toEqual(["api-1"]);
    expect(scoreOf("api-2")).toBeUndefined();
  });

  it("computes uptime from the stored start time", async () => {
    const startedAtMs = Date.now() - 5000;
    state.sortedSet.push({ id: "api-1", score: Date.now() });
    putPayload("api-1", {
      id: "api-1",
      role: "api",
      startedAt: new Date(startedAtMs).toISOString(),
      startedAtMs,
      memoryRss: 1024,
      heapUsed: 512,
      node: "node-a",
      nodeVersion: "v22.0.0",
      pid: 7,
    });

    const [instance] = await listLiveInstances();

    expect(instance.uptimeSeconds).toBeGreaterThanOrEqual(5);
    expect(instance.lastSeenMs).toBeGreaterThan(0);
  });

  it("returns an empty list when no instance registered", async () => {
    expect(await listLiveInstances()).toEqual([]);
  });

  it("falls back to three expected instances when FLEET_SIZE is invalid", () => {
    expect(getExpectedInstances()).toBe(3);

    process.env.FLEET_SIZE = "0";
    expect(getExpectedInstances()).toBe(3);

    process.env.FLEET_SIZE = "not-a-number";
    expect(getExpectedInstances()).toBe(3);

    process.env.FLEET_SIZE = "5";
    expect(getExpectedInstances()).toBe(5);
  });
});
