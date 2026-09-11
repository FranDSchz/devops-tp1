import { describe, it, expect, vi } from "vitest";

vi.mock("./store/redis.js", () => ({
  getRedis: vi.fn(),
  closeRedis: vi.fn(),
}));

import { buildApp } from "./index.js";
import { getRedis } from "./store/redis.js";

describe("GET /ready", () => {
  it("returns 200 with status ok when redis responds", async () => {
    vi.mocked(getRedis).mockReturnValue({ ping: async () => "PONG" } as never);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
    await app.close();
  });

  it("returns 503 when redis fails", async () => {
    vi.mocked(getRedis).mockReturnValue({
      ping: async () => {
        throw new Error("down");
      },
    } as never);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
