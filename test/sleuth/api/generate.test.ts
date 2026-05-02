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

import { POST } from "@/app/api/sleuth/worlds/generate/route";
import { getDb, resetDb } from "@/lib/sleuth/db/client";
import { worlds } from "@/lib/sleuth/db/schema";

interface GenerateBody {
  script_id: string;
  world_prompt: {
    type: "text";
    text_prompt: string;
    disable_recaption?: boolean | null;
  };
  display_name?: string;
}

function makeRequest(body: GenerateBody, secret?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret !== undefined) {
    headers.set("x-sleuth-secret", secret);
  }
  return new Request("http://localhost/api/sleuth/worlds/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/sleuth/worlds/generate", () => {
  beforeEach(() => {
    vi.stubEnv("SLEUTH_DB_PATH", ":memory:");
    vi.stubEnv("SLEUTH_SECRET", "test-secret");
    vi.stubEnv("WLT_API_KEY", "test-key");
    resetDb();
    mocks.generate.mockReset();
    mocks.poll.mockReset();
  });

  afterEach(() => {
    resetDb();
    vi.unstubAllEnvs();
  });

  it("returns 401 when x-sleuth-secret is missing and never touches the DB or provider", async () => {
    const response = await POST(
      makeRequest({
        script_id: "the-empress-last-tea",
        world_prompt: { type: "text", text_prompt: "tea parlour" },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(mocks.generate).not.toHaveBeenCalled();

    const rows = getDb().select().from(worlds).all();
    expect(rows).toHaveLength(0);
  });

  it("returns the cached splat without calling the provider on cache hit", async () => {
    getDb()
      .insert(worlds)
      .values({
        script_id: "the-empress-last-tea",
        operation_id: "op_old",
        splat_url: "/cached.splat",
        status: "done",
        world_prompt_json: '{"type":"text","text_prompt":"tea parlour"}',
        created_at: new Date(),
        expires_at: null,
      })
      .run();

    const response = await POST(
      makeRequest(
        {
          script_id: "the-empress-last-tea",
          world_prompt: { type: "text", text_prompt: "tea parlour" },
        },
        "test-secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      done: true,
      splat_url: "/cached.splat",
      cached: true,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("calls the provider and writes a pending row on cache miss", async () => {
    mocks.generate.mockResolvedValue({ operation_id: "op_test" });

    const response = await POST(
      makeRequest(
        {
          script_id: "new-script",
          world_prompt: { type: "text", text_prompt: "a new place" },
        },
        "test-secret",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ operation_id: "op_test" });

    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate.mock.calls[0][0]).toMatchObject({
      script_id: "new-script",
      world_prompt: { type: "text", text_prompt: "a new place" },
    });

    const row = getDb()
      .select()
      .from(worlds)
      .where(eq(worlds.script_id, "new-script"))
      .get();
    expect(row).toBeDefined();
    expect(row?.status).toBe("pending");
    expect(row?.operation_id).toBe("op_test");
    expect(row?.world_prompt_json).toBe(
      '{"type":"text","text_prompt":"a new place"}',
    );
  });
});
