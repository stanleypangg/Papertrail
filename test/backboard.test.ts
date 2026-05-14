import { afterEach, describe, expect, it, vi } from "vitest";

import { __backboardTestExports } from "@/lib/backboard";

const {
  backboardThinkingPayload,
  extractBackboardDiagnostics,
  extractBackboardStreamChunk,
  filterJsonOutputModelCandidates,
  parseBackboardModelCandidates,
  readBackboardStream
} = __backboardTestExports;

describe("Backboard adapter helpers", () => {
  const originalThinkingEffort = process.env.BACKBOARD_THINKING_EFFORT;

  afterEach(() => {
    process.env.BACKBOARD_THINKING_EFFORT = originalThinkingEffort;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses configured model candidates with providers and removes duplicates", () => {
    expect(
      parseBackboardModelCandidates("google:gemini-3-flash-preview, openai:gpt-5.2, google:gemini-3-flash-preview")
    ).toEqual([
      { provider: "google", modelName: "gemini-3-flash-preview" },
      { provider: "openai", modelName: "gpt-5.2" }
    ]);
  });

  it("omits invalid thinking effort and includes valid effort", () => {
    process.env.BACKBOARD_THINKING_EFFORT = "verbose";
    expect(backboardThinkingPayload()).toEqual({});

    process.env.BACKBOARD_THINKING_EFFORT = " High ";
    expect(backboardThinkingPayload()).toEqual({ thinking: { effort: "high" } });
  });

  it("extracts diagnostics from Backboard response payloads", () => {
    expect(
      extractBackboardDiagnostics({
        model_provider: "google",
        model_name: "gemini-3-flash-preview",
        status: "COMPLETED",
        thread_id: "thread_123",
        message_id: "message_123",
        input_tokens: "120",
        output_tokens: 40,
        context_usage: 0.42
      })
    ).toEqual({
      provider: "google",
      modelName: "gemini-3-flash-preview",
      status: "COMPLETED",
      threadId: "thread_123",
      messageId: "message_123",
      inputTokens: 120,
      outputTokens: 40,
      contextUsage: 0.42
    });
  });

  it("extracts content chunks from payload type when SSE event is generic", () => {
    expect(
      extractBackboardStreamChunk("message", {
        type: "content_streaming",
        content: "{\"scenes\":"
      })
    ).toBe("{\"scenes\":");
  });

  it("ignores reasoning chunks", () => {
    expect(
      extractBackboardStreamChunk("message", {
        type: "reasoning_streaming",
        content: "thinking text"
      })
    ).toBe("");
  });

  it("reads streamed content and emits run-ended diagnostics", async () => {
    const diagnostics = vi.fn();
    const chunks = vi.fn();
    const stream = streamFromText(
      [
        `data: ${JSON.stringify({ type: "reasoning_streaming", content: "hidden" })}`,
        "",
        `data: ${JSON.stringify({ type: "content_streaming", content: "{\"scenes\":[]" })}`,
        "",
        `data: ${JSON.stringify({ type: "content_streaming", content: "}" })}`,
        "",
        `data: ${JSON.stringify({ type: "run_ended", model_provider: "google", model_name: "gemini", output_tokens: 12 })}`,
        "",
        ""
      ].join("\n")
    );

    await expect(readBackboardStream(stream, { onChunk: chunks, onDiagnostics: diagnostics })).resolves.toBe(
      "{\"scenes\":[]}"
    );
    expect(chunks).toHaveBeenCalledTimes(2);
    expect(diagnostics).toHaveBeenCalledWith({
      provider: "google",
      modelName: "gemini",
      outputTokens: 12
    });
  });

  it("filters model candidates to JSON-output-capable models and fails open when none match", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { provider: "google", name: "gemini-3-flash-preview", supports_json_output: true },
          { provider: "openai", name: "gpt-5.2", supports_json_output: false }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidates = [
      { provider: "google", modelName: "gemini-3-flash-preview" },
      { provider: "openai", modelName: "gpt-5.2" }
    ];

    await expect(filterJsonOutputModelCandidates("key", candidates)).resolves.toEqual([
      { provider: "google", modelName: "gemini-3-flash-preview" }
    ]);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] })
    });
    await expect(filterJsonOutputModelCandidates("key", candidates)).resolves.toEqual(candidates);
  });
});

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    }
  });
}
