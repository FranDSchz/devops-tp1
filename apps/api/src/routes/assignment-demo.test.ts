import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../index.js";
import { assignIncident } from "../store/assignment.js";

vi.mock("../store/assignment.js", () => ({ assignIncident: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("assignment demo routes", () => {
  it("does not expose either demo route by default", async () => {
    vi.stubEnv("RACE_DEMO_ENABLED", "false");
    const app = buildApp();
    try {
      for (const mode of ["vulnerable", "protected"]) {
        const response = await app.inject({
          method: "POST", url: `/api/demo/incidents/one/assign/${mode}`,
          payload: { responsible: "Ana" },
        });
        expect(response.statusCode).toBe(404);
      }
      expect(assignIncident).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it.each(["vulnerable", "protected"] as const)("validates input for %s", async (mode) => {
    vi.stubEnv("RACE_DEMO_ENABLED", "true");
    const app = buildApp();
    try {
      for (const payload of [{}, { responsible: "" }, { responsible: "   " }, { responsible: 5 }]) {
        const response = await app.inject({
          method: "POST", url: `/api/demo/incidents/one/assign/${mode}`, payload,
        });
        expect(response.statusCode).toBe(400);
      }
      expect(assignIncident).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it.each([
    ["assigned", 200], ["conflict", 409], ["not-found", 404],
  ] as const)("maps %s to HTTP %i", async (result, status) => {
    vi.stubEnv("RACE_DEMO_ENABLED", "true");
    vi.mocked(assignIncident).mockResolvedValue(result);
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "POST", url: "/api/demo/incidents/one/assign/protected",
        payload: { responsible: "Ana" },
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({ result, mode: "protected" });
      expect(assignIncident).toHaveBeenCalledWith("one", "Ana", "protected");
    } finally { await app.close(); }
  });
});
