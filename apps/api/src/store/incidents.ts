import { randomUUID } from "node:crypto";
import { getRedis } from "./redis.js";
import type { Incident, CreateIncidentBody, UpdateIncidentBody } from "../types/incident.js";

const INDEX_KEY = "incidents";

function incidentKey(id: string): string {
  return `incident:${id}`;
}

function toHash(incident: Incident): Record<string, string> {
  return {
    id: incident.id,
    title: incident.title,
    service: incident.service,
    severity: incident.severity,
    status: incident.status,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

function fromHash(hash: Record<string, string>): Incident | null {
  if (!hash.id) return null;
  return {
    id: hash.id,
    title: hash.title,
    service: hash.service,
    severity: hash.severity as Incident["severity"],
    status: hash.status as Incident["status"],
    createdAt: hash.createdAt,
    updatedAt: hash.updatedAt,
  };
}

export async function listIncidents(): Promise<Incident[]> {
  const redis = getRedis();
  const ids = await redis.smembers(INDEX_KEY);
  if (ids.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const rawId of ids) {
    pipeline.hgetall(rawId);
  }
  const results = await pipeline.exec();
  if (!results) return [];

  const incidents: Incident[] = [];
  for (const result of results) {
    const [err, data] = result as [Error | null, Record<string, string>];
    if (!err && data) {
      const incident = fromHash(data);
      if (incident) incidents.push(incident);
    }
  }
  return incidents;
}

export async function getIncident(id: string): Promise<Incident | null> {
  const redis = getRedis();
  const hash = await redis.hgetall(incidentKey(id));
  return fromHash(hash);
}

export async function createIncident(body: CreateIncidentBody): Promise<Incident> {
  const redis = getRedis();
  const now = new Date().toISOString();
  const incident: Incident = {
    id: randomUUID(),
    title: body.title,
    service: body.service,
    severity: body.severity,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  const pipeline = redis.pipeline();
  pipeline.hset(incidentKey(incident.id), toHash(incident));
  pipeline.sadd(INDEX_KEY, incidentKey(incident.id));
  await pipeline.exec();

  return incident;
}

export async function updateIncident(
  id: string,
  body: UpdateIncidentBody
): Promise<Incident | null> {
  const redis = getRedis();
  const existing = await getIncident(id);
  if (!existing) return null;

  const updated: Incident = {
    ...existing,
    ...(body.title !== undefined && { title: body.title }),
    ...(body.service !== undefined && { service: body.service }),
    ...(body.severity !== undefined && { severity: body.severity }),
    ...(body.status !== undefined && { status: body.status }),
    updatedAt: new Date().toISOString(),
  };

  await redis.hset(incidentKey(id), toHash(updated));
  return updated;
}

export async function deleteIncident(id: string): Promise<boolean> {
  const redis = getRedis();
  const key = incidentKey(id);
  const existed = await redis.exists(key);
  if (!existed) return false;

  const pipeline = redis.pipeline();
  pipeline.del(key);
  pipeline.srem(INDEX_KEY, key);
  await pipeline.exec();
  return true;
}
