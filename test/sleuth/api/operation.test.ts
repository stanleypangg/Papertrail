import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  poll: vi.fn(),
}));

vi.mock("@/lib/sleuth/world-generator", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/sleuth/world-generator")
  >("@/lib/sleuth/world-generator");
  return {
    ...actual,
    worldGenerator: { generate: mocks.generate, poll: mocks.poll },
  };
});

import { GET } from "@/app/api/sleuth/worlds/[operationId]/route";
import { getDb, resetDb } from "@/lib/sleuth/db/client";
import { worlds } from "@/lib/sleuth/db/schema";
import { MarbleOperationError } from "@/lib/sleuth/world-generator";

function callGet(operationId: string): Promise<Response> {
  const request = new Request(
    `http://localhost/api/sleuth/worlds/${operationId}`,
  );
  return GET(request, { params: Promise.resolve({ operationId }) });
}

describe("GET /api/sleuth/worlds/[operationId]", () => {
  beforeEach(() => {
    vi.stubEnv("SLEUTH_DB_PATH", ":memory:");
    vi.stubEnv("WLT_API_KEY", "test-key");
    resetDb();
    mocks.generate.mockReset();
    mocks.poll.mockReset();
  });

  afterEach(() => {
    resetDb();
    vi.unstubAllEnvs();
  });

  it("returns { done: false, operation_id } and leaves the DB row pending while Marble works", async () => {
    mocks.poll.mockResolvedValue({ done: false });

    getDb()
      .insert(worlds)
      .values({
        script_id: "s1",
        operation_id: "op_pending",
        splat_url: null,
        status: "pending",
        world_prompt_json: null,
        created_at: new Date(),
        expires_at: null,
      })
      .run();

    const response = await callGet("op_pending");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      done: false,
      operation_id: "op_pending",
    });

    const row = getDb()
      .select()
      .from(worlds)
      .where(eq(worlds.operation_id, "op_pending"))
      .get();
    expect(row?.status).toBe("pending");
  });

  it("returns the splat url and updates the DB row to status=done", async () => {
    mocks.poll.mockResolvedValue({
      done: true,
      splat_url: "https://cdn.example/world.spz",
    });

    getDb()
      .insert(worlds)
      .values({
        script_id: "s2",
        operation_id: "op_done",
        splat_url: null,
        status: "pending",
        world_prompt_json: '{"type":"text","text_prompt":"a"}',
        created_at: new Date(),
        expires_at: null,
      })
      .run();

    const response = await callGet("op_done");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      done: true,
      splat_url: "https://cdn.example/world.spz",
    });

    const row = getDb()
      .select()
      .from(worlds)
      .where(eq(worlds.operation_id, "op_done"))
      .get();
    expect(row?.status).toBe("done");
    expect(row?.splat_url).toBe("https://cdn.example/world.spz");
  });

  it("auto-regenerates on expired and returns the new operation_id with regenerated:true", async () => {
    mocks.poll.mockRejectedValue(
      new MarbleOperationError("expired", "expired"),
    );
    mocks.generate.mockResolvedValue({ operation_id: "op_new" });

    getDb()
      .insert(worlds)
      .values({
        script_id: "s3",
        operation_id: "op_old",
        splat_url: null,
        status: "pending",
        world_prompt_json: '{"type":"text","text_prompt":"parlour"}',
        created_at: new Date(),
        expires_at: null,
      })
      .run();

    const response = await callGet("op_old");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      done: false,
      operation_id: "op_new",
      regenerated: true,
    });

    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate.mock.calls[0][0]).toMatchObject({
      script_id: "s3",
      world_prompt: { type: "text", text_prompt: "parlour" },
    });

    const row = getDb()
      .select()
      .from(worlds)
      .where(eq(worlds.script_id, "s3"))
      .get();
    expect(row?.operation_id).toBe("op_new");
    expect(row?.status).toBe("pending");
  });
});
