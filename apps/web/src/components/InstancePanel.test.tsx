import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { InstancePanel } from "./InstancePanel";
import type { Fleet, InstanceInfo, Readiness } from "../types/instance";

function buildInstance(id: string, overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    id,
    role: "api",
    startedAt: "2026-01-01T12:00:00.000Z",
    startedAtMs: Date.UTC(2026, 0, 1, 12, 0, 0),
    uptimeSeconds: 3725,
    memoryRss: 52428800,
    heapUsed: 12582912,
    node: "opsboard-node-01",
    nodeVersion: "v22.11.0",
    pid: 42,
    lastSeenMs: Date.UTC(2026, 0, 1, 12, 5, 0),
    ...overrides,
  };
}

function buildFleet(instances: InstanceInfo[], servedBy: string, expected = 3): Fleet {
  return { servedBy, count: instances.length, expected, heartbeatTtlMs: 15000, instances };
}

const ready: Readiness = { status: "ok", redis: "ok", instance: "api-1", uptimeSeconds: 30 };

function renderPanel(overrides: Partial<Parameters<typeof InstancePanel>[0]> = {}) {
  const props = {
    fleet: buildFleet([buildInstance("api-1"), buildInstance("api-2")], "api-2"),
    readiness: ready,
    webInstance: "web-1",
    isLoading: false,
    lastUpdatedMs: Date.UTC(2026, 0, 1, 12, 5, 0),
    onRefresh: vi.fn(),
    ...overrides,
  };

  return { ...render(<InstancePanel {...props} />), props };
}

describe("InstancePanel", () => {
  it("renders one card per registered replica", () => {
    renderPanel({
      fleet: buildFleet(
        [buildInstance("api-1"), buildInstance("api-2"), buildInstance("api-3")],
        "api-1",
      ),
    });

    const panel = screen.getByLabelText("Estado de las instancias del servicio");
    expect(within(panel).getAllByRole("listitem")).toHaveLength(3);
    expect(panel).toHaveTextContent("3 / 3 réplicas API en línea");
  });

  it("shows runtime metrics for each replica", () => {
    renderPanel({
      fleet: buildFleet([buildInstance("api-1", { uptimeSeconds: 45, memoryRss: 1048576 })], "api-1", 1),
    });

    const panel = screen.getByLabelText("Estado de las instancias del servicio");
    expect(panel).toHaveTextContent("45s");
    expect(panel).toHaveTextContent("1.0 MB");
    expect(panel).toHaveTextContent("v22.11.0");
  });

  it("marks only the instance that served the request", () => {
    renderPanel();

    const panel = screen.getByLabelText("Estado de las instancias del servicio");
    expect(within(panel).getAllByText("sirviendo tu sesión")).toHaveLength(1);

    const activeCard = panel.querySelector(".replica-card--active");
    expect(activeCard).toHaveTextContent("api-2");
  });

  it("warns when the fleet is below the expected size", () => {
    renderPanel();

    const panel = screen.getByLabelText("Estado de las instancias del servicio");
    expect(panel).toHaveTextContent("2 / 3 réplicas API en línea");
    expect(within(panel).getByRole("status")).toHaveTextContent("Replica caída");
  });

  it("reports the redis readiness from the diagnostic endpoint", () => {
    const { rerender, props } = renderPanel();
    const panel = screen.getByLabelText("Estado de las instancias del servicio");
    expect(panel).toHaveTextContent("Redis conectado");

    rerender(<InstancePanel {...props} readiness={{ ...ready, redis: "unreachable" }} />);
    expect(screen.getByLabelText("Estado de las instancias del servicio")).toHaveTextContent(
      "Redis sin respuesta",
    );
  });

  it("falls back to an explanatory message when no replica is registered", () => {
    renderPanel({ fleet: buildFleet([], "api-1") });

    const panel = screen.getByLabelText("Estado de las instancias del servicio");
    expect(panel).toHaveTextContent("0 / 3 réplicas API en línea");
    expect(panel).toHaveTextContent("Sin instancias registradas");
  });

  it("always shows which web replica served the page", () => {
    renderPanel({ webInstance: "web-3" });

    const panel = screen.getByLabelText("Estado de las instancias del servicio");
    expect(panel).toHaveTextContent("web-3");
  });

  it("triggers the refresh callback", () => {
    const { props } = renderPanel();

    screen.getByRole("button", { name: "Actualizar" }).click();

    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });
});
