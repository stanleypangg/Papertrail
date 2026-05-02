import { describe, expect, it } from "vitest";

import {
  buildInitialWorldState,
  estimateWorldProgress,
} from "@/components/sleuth/world-status";

describe("components/sleuth/world-status", () => {
  it("maps a pending SQLite row into a pollable pending state", () => {
    const createdAt = new Date("2026-05-02T20:00:00.000Z");

    expect(
      buildInitialWorldState({
        script_id: "the-empress-last-tea",
        operation_id: "op_pending",
        splat_url: null,
        status: "pending",
        world_prompt_json: null,
        created_at: createdAt,
        expires_at: null,
        portraits_generated_at: null,
      }),
    ).toEqual({
      kind: "pending",
      operationId: "op_pending",
      degraded: false,
      startedAt: createdAt.getTime(),
    });
  });

  it("marks mock-backed worlds as degraded when the cached row is already done", () => {
    expect(
      buildInitialWorldState({
        script_id: "the-empress-last-tea",
        operation_id: "mock-the-empress-last-tea-1234",
        splat_url: "/splats/the-empress-last-tea-cached.splat",
        status: "done",
        world_prompt_json: null,
        created_at: new Date("2026-05-02T20:00:00.000Z"),
        expires_at: null,
        portraits_generated_at: null,
      }),
    ).toEqual({
      kind: "done",
      operationId: "mock-the-empress-last-tea-1234",
      degraded: true,
      splatUrl: "/splats/the-empress-last-tea-cached.splat",
    });
  });

  it("fills progress by elapsed time but caps pending progress at 95 percent", () => {
    const startedAt = Date.parse("2026-05-02T20:00:00.000Z");

    expect(estimateWorldProgress(startedAt, startedAt + 60_000)).toBe(50);
    expect(estimateWorldProgress(startedAt, startedAt + 240_000)).toBe(95);
  });
});
