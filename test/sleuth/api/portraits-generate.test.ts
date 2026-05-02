import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generatePortrait: vi.fn(),
}));

vi.mock("@/lib/sleuth/images/client", () => ({
  generatePortrait: mocks.generatePortrait,
}));

import { POST } from "@/app/api/sleuth/portraits/generate/route";
import { getDb, resetDb } from "@/lib/sleuth/db/client";
import { worlds } from "@/lib/sleuth/db/schema";

function makeRequest(scriptId: string, secret?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret !== undefined) {
    headers.set("x-sleuth-secret", secret);
  }
  return new Request("http://localhost/api/sleuth/portraits/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({ script_id: scriptId }),
  });
}

describe("POST /api/sleuth/portraits/generate", () => {
  beforeEach(() => {
    vi.stubEnv("SLEUTH_DB_PATH", ":memory:");
    vi.stubEnv("SLEUTH_SECRET", "test-secret");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    resetDb();
    mocks.generatePortrait.mockReset();
    mocks.generatePortrait.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetDb();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 401 when the sleuth secret is missing", async () => {
    const response = await POST(makeRequest("the-empress-last-tea"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(mocks.generatePortrait).not.toHaveBeenCalled();
  });

  it("returns cached:true and skips portrait work when portraits were already generated", async () => {
    getDb()
      .insert(worlds)
      .values({
        script_id: "the-empress-last-tea",
        portraits_generated_at: new Date(),
      })
      .run();

    const response = await POST(
      makeRequest("the-empress-last-tea", "test-secret"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ started: false, cached: true });
    expect(mocks.generatePortrait).not.toHaveBeenCalled();
  });

  it("generates portraits with force overwrite and records portraits_generated_at", async () => {
    const response = await POST(
      makeRequest("the-empress-last-tea", "test-secret"),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ started: true, generated: 5 });
    expect(mocks.generatePortrait).toHaveBeenCalledTimes(5);
    expect(mocks.generatePortrait.mock.calls[0]?.[0]).toMatchObject({
      characterName: "Mei-Lin · 美琳",
      force: true,
    });

    const row = getDb()
      .select()
      .from(worlds)
      .where(eq(worlds.script_id, "the-empress-last-tea"))
      .get();
    expect(row?.portraits_generated_at).toBeInstanceOf(Date);
  });
});
