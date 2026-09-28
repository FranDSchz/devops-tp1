export interface InstanceInfo {
  id: string;
  role: "api";
  startedAt: string;
  startedAtMs: number;
  uptimeSeconds: number;
  memoryRss: number;
  heapUsed: number;
  node: string;
  nodeVersion: string;
  pid: number;
  lastSeenMs: number;
}

export interface FleetResponse {
  servedBy: string;
  count: number;
  expected: number;
  heartbeatTtlMs: number;
  instances: InstanceInfo[];
}
