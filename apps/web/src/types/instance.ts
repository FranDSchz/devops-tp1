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

export interface Fleet {
  servedBy: string;
  count: number;
  expected: number;
  heartbeatTtlMs: number;
  instances: InstanceInfo[];
}

export interface Readiness {
  status: "ok" | "not-ready";
  redis: "ok" | "unreachable";
  instance: string;
  uptimeSeconds: number;
}

export interface WebInstance {
  instance: string;
}
