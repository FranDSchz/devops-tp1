import type { Fleet, Readiness, WebInstance } from "../types/instance";
import { apiRequest, proxyRequest } from "./client";

export function listFleet(): Promise<Fleet> {
  return apiRequest<Fleet>("/instances");
}

export function getReadiness(): Promise<Readiness> {
  return proxyRequest<Readiness>("/ready");
}

export function getWebInstance(): Promise<WebInstance> {
  return proxyRequest<WebInstance>("/instance.json");
}
