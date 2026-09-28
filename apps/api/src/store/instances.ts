import os from "node:os";
import { getRedis } from "./redis.js";
import type { InstanceInfo } from "../types/instance.js";

const FLEET_KEY = "fleet:api";
const FLEET_DATA_KEY = "fleet:api:data";

export const HEARTBEAT_INTERVAL_MS = 5_000;
export const HEARTBEAT_TTL_MS = 15_000;

const PROCESS_STARTED_AT_MS = Date.now();

interface StoredInstance {
  id: string;
  role: "api";
  startedAt: string;
  startedAtMs: number;
  memoryRss: number;
  heapUsed: number;
  node: string;
  nodeVersion: string;
  pid: number;
}

type FleetRedis = ReturnType<typeof getRedis>;

export function getProcessStartedAtMs(): number {
  return PROCESS_STARTED_AT_MS;
}

export function getInstanceId(): string {
  return process.env.INSTANCE_ID ?? process.pid.toString();
}

export function getExpectedInstances(): number {
  const configured = Number(process.env.FLEET_SIZE);
  return Number.isFinite(configured) && configured > 0 ? configured : 3;
}

function snapshot(id: string): StoredInstance {
  const { rss, heapUsed } = process.memoryUsage();
  return {
    id,
    role: "api",
    startedAt: new Date(PROCESS_STARTED_AT_MS).toISOString(),
    startedAtMs: PROCESS_STARTED_AT_MS,
    memoryRss: rss,
    heapUsed,
    node: os.hostname(),
    nodeVersion: process.version,
    pid: process.pid,
  };
}

function parseStored(raw: string): StoredInstance | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredInstance>;
    if (typeof parsed.id !== "string" || typeof parsed.startedAtMs !== "number") {
      return null;
    }
    return {
      id: parsed.id,
      role: "api",
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date(parsed.startedAtMs).toISOString(),
      startedAtMs: parsed.startedAtMs,
      memoryRss: typeof parsed.memoryRss === "number" ? parsed.memoryRss : 0,
      heapUsed: typeof parsed.heapUsed === "number" ? parsed.heapUsed : 0,
      node: typeof parsed.node === "string" ? parsed.node : "unknown",
      nodeVersion: typeof parsed.nodeVersion === "string" ? parsed.nodeVersion : "unknown",
      pid: typeof parsed.pid === "number" ? parsed.pid : 0,
    };
  } catch {
    return null;
  }
}

export async function registerHeartbeat(id: string): Promise<void> {
  const redis = getRedis();
  const nowMs = Date.now();

  const pipeline = redis.pipeline();
  pipeline.zadd(FLEET_KEY, nowMs, id);
  pipeline.hset(FLEET_DATA_KEY, id, JSON.stringify(snapshot(id)));
  await pipeline.exec();
}

export async function listLiveInstances(nowMs = Date.now()): Promise<InstanceInfo[]> {
  const redis = getRedis();
  const cutoff = nowMs - HEARTBEAT_TTL_MS;
  const scored = (await redis.zrangebyscore(FLEET_KEY, `(${cutoff}`, "+inf", "WITHSCORES")) as
    | string[]
    | null;
  const entries = scored ?? [];

  const ids: string[] = [];
  const lastSeenById = new Map<string, number>();
  for (let i = 0; i + 1 < entries.length; i += 2) {
    ids.push(entries[i]);
    lastSeenById.set(entries[i], Number(entries[i + 1]));
  }

  const instances: InstanceInfo[] = [];
  const orphans: string[] = [];

  if (ids.length > 0) {
    const payloads = await redis.hmget(FLEET_DATA_KEY, ...ids);
    for (let i = 0; i < ids.length; i++) {
      const raw = payloads[i];
      const stored = typeof raw === "string" ? parseStored(raw) : null;
      if (!stored) {
        orphans.push(ids[i]);
        continue;
      }
      instances.push({
        ...stored,
        uptimeSeconds: Math.max(0, Math.floor((nowMs - stored.startedAtMs) / 1000)),
        lastSeenMs: lastSeenById.get(stored.id) ?? nowMs,
      });
    }
  }

  const stale = (await redis.zrangebyscore(FLEET_KEY, "-inf", `(${cutoff}`)) as string[] | null;
  await purge(redis, [...(stale ?? []), ...orphans]);

  return instances.sort((a, b) => a.id.localeCompare(b.id));
}

async function purge(redis: FleetRedis, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const pipeline = redis.pipeline();
  pipeline.zrem(FLEET_KEY, ...ids);
  pipeline.hdel(FLEET_DATA_KEY, ...ids);
  await pipeline.exec();
}
