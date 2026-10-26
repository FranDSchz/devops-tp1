import { setTimeout } from "node:timers/promises";
import { getRedis } from "./redis.js";

export type AssignmentResult = "assigned" | "conflict" | "not-found";
export type AssignmentEvent = { step: "read" | "written" | "atomic"; at: number; assignedTo: string | null; result?: AssignmentResult };

// Runs entirely inside Redis: no other client's command can interleave
// between the availability check and the assignment.
const ASSIGN = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
if redis.call('HEXISTS', KEYS[1], 'assignedTo') == 1 then return 0 end
redis.call('HSET', KEYS[1], 'assignedTo', ARGV[1], 'updatedAt', ARGV[2])
return 1
`;

export async function assignIncident(
  id: string,
  responsible: string,
  mode: "vulnerable" | "protected",
  observe?: (event: AssignmentEvent) => void,
): Promise<AssignmentResult> {
  const redis = getRedis();
  const key = `incident:${id}`;
  if (mode === "protected") {
    const result = Number(await redis.eval(ASSIGN, 1, key, responsible, new Date().toISOString()));
    const outcome = result === -1 ? "not-found" : result === 0 ? "conflict" : "assigned";
    observe?.({ step: "atomic", at: Date.now(), assignedTo: result === 1 ? responsible : null, result: outcome });
    return outcome;
  }

  const incident = await redis.hgetall(key);
  observe?.({ step: "read", at: Date.now(), assignedTo: incident.assignedTo ?? null });
  if (!incident.id) return "not-found";
  if (incident.assignedTo) return "conflict";
  // Educational only: widen the real read/write race window so the demo
  // is observable. This is not a mutex or synchronization mechanism.
  await setTimeout(500);
  await redis.hset(key, { assignedTo: responsible, updatedAt: new Date().toISOString() });
  observe?.({ step: "written", at: Date.now(), assignedTo: responsible });
  return "assigned";
}
