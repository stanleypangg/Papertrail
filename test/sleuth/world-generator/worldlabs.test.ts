import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MarbleAuthError,
  MarbleOperationError,
  MarbleRateLimitError,
  MarbleServerError,
  WorldlabsProvider,
} from "@/lib/sleuth/world-generator";
import {
  MARBLE_BASE_URL,
  MARBLE_GENERATE_PATH,
  MARBLE_OPERATIONS_PATH,
} from "@/lib/sleuth/world-generator/worldlabs";

interface FakeResponseInit {
  ok?: boolean;
  status?: number;
  body?: unknown;
}

function fakeResponse({ ok, status = 200, body = {} }: FakeResponseInit): Response {
  const isOk = ok ?? (status >= 200 && status < 300);
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: isOk,
    status,
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    text: async () => text,
  } as unknown as Response;
}

const generateInput = {
  script_id: "the-empress-last-tea",
  world_prompt: { type: "text" as const, text_prompt: "A 1920s tea parlour." },
  display_name: "sleuth-test",
};

describe("WorldlabsProvider.generate", () => {
  beforeEach(() => {
    vi.stubEnv("WLT_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns operation_id and sends WLT-Api-Key to /worlds:generate on 200 OK", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({ status: 200, body: { operation_id: "op_xxx" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorldlabsProvider();
    const result = await provider.generate(generateInput);

    expect(result).toEqual({ operation_id: "op_xxx" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(`${MARBLE_BASE_URL}${MARBLE_GENERATE_PATH}`);
    expect(calledUrl).toContain("/worlds:generate");
    const headers = calledInit.headers as Record<string, string>;
    expect(headers["WLT-Api-Key"]).toBe("test-key");
    expect(headers["Authorization"]).toBeUndefined();
    expect(calledInit.method).toBe("POST");
    const body = JSON.parse(calledInit.body as string) as Record<string, unknown>;
    expect(body.model).toBe("marble-1.0-draft");
    expect(body.display_name).toBe("sleuth-test");
  });

  it("throws MarbleAuthError on 401 without retrying", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({ status: 401, body: { detail: "bad key" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorldlabsProvider();
    await expect(provider.generate(generateInput)).rejects.toBeInstanceOf(
      MarbleAuthError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws MarbleRateLimitError on 429 without retrying", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({ status: 429, body: { detail: "slow down" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorldlabsProvider();
    await expect(provider.generate(generateInput)).rejects.toBeInstanceOf(
      MarbleRateLimitError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on 5xx and succeeds on the second attempt", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ status: 503, body: "boom" }))
      .mockResolvedValueOnce(
        fakeResponse({ status: 200, body: { operation_id: "op_retry" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorldlabsProvider();
    const promise = provider.generate(generateInput);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ operation_id: "op_retry" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("WorldlabsProvider.poll", () => {
  beforeEach(() => {
    vi.stubEnv("WLT_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns { done: false } when the operation is still pending", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        status: 200,
        body: { done: false, operation_id: "op_pending" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorldlabsProvider();
    const result = await provider.poll("op_pending");

    expect(result).toEqual({ done: false });
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(
      `${MARBLE_BASE_URL}${MARBLE_OPERATIONS_PATH}/op_pending`,
    );
  });

  it("returns { done: true, splat_url } when assets.splats.spz_urls is populated", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        status: 200,
        body: {
          done: true,
          operation_id: "op_done",
          response: {
            assets: {
              splats: {
                spz_urls: {
                  primary: "https://cdn.example/world.spz",
                },
              },
            },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorldlabsProvider();
    const result = await provider.poll("op_done");

    expect(result).toEqual({
      done: true,
      splat_url: "https://cdn.example/world.spz",
    });
  });

  it("throws MarbleOperationError when the response carries an error field", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        status: 200,
        body: {
          done: true,
          operation_id: "op_err",
          error: { code: 500, message: "internal" },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorldlabsProvider();
    await expect(provider.poll("op_err")).rejects.toBeInstanceOf(
      MarbleOperationError,
    );
  });

  it("throws MarbleOperationError with kind 'expired' on 404", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({ status: 404, body: { detail: "not found" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorldlabsProvider();
    let caught: unknown;
    try {
      await provider.poll("op_expired");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MarbleOperationError);
    expect((caught as MarbleOperationError).kind).toBe("expired");
    // Sanity-check that other error classes are not the right tool here.
    expect(caught).not.toBeInstanceOf(MarbleServerError);
  });
});
