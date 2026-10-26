import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import BlueGreenDemo from "./BlueGreenDemo";

let active: "blue" | "green";
const fetchStub = vi.fn();

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  active = "blue";
  fetchStub.mockReset();
  fetchStub.mockImplementation(async (path: string) => {
    if (path === "/health") return response({ status: "ok", instance: `${active}-api-1` });
    if (path === "/instance.json") return response({ instance: `${active}-web-2` });
    if (path === "/ready") return response({ redis: "ok" });
    if (path === "/api/incidents") return response([{ id: "incident-1" }]);
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Blue-green demo", () => {
  it("shows the observed blue → green → blue switch without reloading the page", async () => {
    render(<BlueGreenDemo />);

    expect(await screen.findByText("Inicio en Blue")).toBeInTheDocument();
    expect(screen.getAllByText("blue-api-1").length).toBeGreaterThan(0);
    expect(screen.getByText("1", { selector: ".bg-demo__facts strong" })).toBeInTheDocument();

    active = "green";
    fireEvent.click(screen.getByRole("button", { name: "Actualizar ahora" }));
    expect(await screen.findByText("Blue → Green")).toBeInTheDocument();
    expect(screen.getAllByText("green-web-2").length).toBeGreaterThan(0);

    active = "blue";
    fireEvent.click(screen.getByRole("button", { name: "Actualizar ahora" }));
    expect(await screen.findByText("Green → Blue")).toBeInTheDocument();
    expect(fetchStub).toHaveBeenCalledWith("/instance.json", expect.objectContaining({ cache: "no-store" }));
  });
});
