import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    body: null,
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    text: async () => text,
  } as unknown as Response;
}

describe("lib/sleuth/llm/client", () => {
  beforeEach(() => {
    vi.stubEnv("BACKBOARD_API_KEY", "backboard-key");
    vi.stubEnv("SLEUTH_MODEL_FAST", "gemini-fast");
    vi.stubEnv("SLEUTH_MODEL_PROSE", "gemini-prose");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns host content and calls the Backboard threads endpoint with the prose model", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        status: 200,
        body: {
          body: {
            content: "The lamps tremble against the lacquered screens.",
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { streamHost } = await import("@/lib/sleuth/llm/client");
    const result = await streamHost("You are the host.", [
      { role: "user", content: "Script context: parlour." },
      { role: "user", content: "Open the scene." },
    ]);

    expect(result).toBe("The lamps tremble against the lacquered screens.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(calledUrl).toBe("https://app.backboard.io/api/threads/messages");
    expect(calledInit.method).toBe("POST");

    const headers = calledInit.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("backboard-key");

    const body = JSON.parse(calledInit.body as string) as Record<string, unknown>;
    expect(body.model_name).toBe("gemini-prose");
    expect(body.stream).toBe(true);
    expect(body.system_prompt).toBe("You are the host.");
    expect(body.content).toContain("Script context: parlour.");
    expect(body.content).toContain("Open the scene.");
  });

  it("retries once on a retryable Backboard failure and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ status: 503, body: { error: "busy" } }))
      .mockResolvedValueOnce(
        fakeResponse({
          status: 200,
          body: { body: { content: "Madam Wu folds her fan shut." } },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { npcReply } = await import("@/lib/sleuth/llm/client");
    const promise = npcReply(
      "madam-wu",
      "Stay in character.",
      [{ role: "user", content: "Script context: parlour." }],
      "Who left the poison tin behind?",
    );

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("Madam Wu folds her fan shut.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the host-style fallback line after retrying and failing twice", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ status: 502, body: { error: "bad gateway" } }))
      .mockResolvedValueOnce(fakeResponse({ status: 503, body: { error: "still busy" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { streamHost } = await import("@/lib/sleuth/llm/client");
    const promise = streamHost("You are the host.", [
      { role: "user", content: "Script context: parlour." },
      { role: "user", content: "Continue." },
    ]);

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("...the room falls silent for a long moment.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
