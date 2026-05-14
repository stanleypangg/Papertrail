import { demoScenes } from "./demoData";
import { buildScenePlannerPrompt, extractJsonObject, SCENE_PLANNER_SYSTEM_PROMPT } from "./scenePrompt";
import { normalizeScenePlans, type ScenePlan } from "./sceneSchema";

const BACKBOARD_URL = "https://app.backboard.io/api/threads/messages";
const BACKBOARD_MODELS_URL = "https://app.backboard.io/api/models";
const MODEL_CANDIDATES = ["gemini-3-flash-preview", "gemini-2.5-flash"];
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const MAX_RETRY_ATTEMPTS = 3;
const MODEL_VALIDATION_TIMEOUT_MS = 4_000;
const THINKING_EFFORTS = new Set(["low", "medium", "high", "max"]);

type BackboardModelCandidate = {
  modelName?: string;
  provider?: string;
};

type BackboardStreamOptions = {
  onChunk?: (chunk: string) => void;
  onDiagnostics?: (diagnostics: BackboardDiagnostics) => void;
};

type BackboardRequestOptions = {
  apiKey: string;
  text: string;
  stream: boolean;
  candidate: BackboardModelCandidate;
};

type BackboardDiagnostics = {
  provider?: string;
  modelName?: string;
  status?: string;
  threadId?: string;
  messageId?: string;
  runId?: string;
  inputTokens?: number;
  outputTokens?: number;
  contextUsage?: number;
};

type BackboardModelRecord = {
  name?: unknown;
  provider?: unknown;
  supports_json_output?: unknown;
};

class BackboardRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "BackboardRequestError";
  }
}

export async function generateScenesWithBackboard(text: string): Promise<ScenePlan[]> {
  const apiKey = process.env.BACKBOARD_API_KEY;

  if (!apiKey) {
    throw new Error("BACKBOARD_API_KEY is missing.");
  }

  let lastError: unknown;

  for (const candidate of await backboardModelCandidates(apiKey, true)) {
    try {
      const response = await postBackboardMessageWithRetry({
        apiKey,
        text,
        stream: false,
        candidate
      });
      const body = await response.json();
      logBackboardDiagnostics(extractBackboardDiagnostics(body));
      const scenes = scenesFromBackboardBody(body);

      if (scenes.length > 0) {
        return scenes;
      }

      throw new Error("Backboard returned no valid scenes.");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Backboard scene generation failed.");
}

export async function generateScenesWithBackboardStreamed(
  text: string,
  options: BackboardStreamOptions = {}
): Promise<ScenePlan[]> {
  const apiKey = process.env.BACKBOARD_API_KEY;

  if (!apiKey) {
    throw new Error("BACKBOARD_API_KEY is missing.");
  }

  let lastError: unknown;

  for (const candidate of await backboardModelCandidates(apiKey, false)) {
    try {
      const response = await postBackboardMessageWithRetry({
        apiKey,
        text,
        stream: true,
        candidate
      });
      if (!response.body) {
        throw new Error("Backboard returned an empty stream.");
      }

      const streamedText = await readBackboardStream(response.body, {
        ...options,
        onDiagnostics: (diagnostics) => {
          logBackboardDiagnostics(diagnostics);
          options.onDiagnostics?.(diagnostics);
        }
      });
      const json = extractJsonObject(streamedText);
      const scenes = normalizeScenePlans(json);

      if (scenes.length > 0) {
        return scenes;
      }

      throw new Error("Backboard returned no valid scenes.");
    } catch (error) {
      lastError = error;
    }
  }

  for (const candidate of await backboardModelCandidates(apiKey, true)) {
    try {
      const response = await postBackboardMessageWithRetry({
        apiKey,
        text,
        stream: false,
        candidate
      });
      const body = await response.json();
      logBackboardDiagnostics(extractBackboardDiagnostics(body));
      const scenes = scenesFromBackboardBody(body);

      if (scenes.length > 0) {
        return scenes;
      }

      throw new Error("Backboard non-stream fallback returned no valid scenes.");
    } catch (error) {
      lastError = new Error(`Backboard stream and non-stream fallback failed: ${errorMessage(error)}`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Backboard scene generation failed.");
}

function scenesFromBackboardBody(body: unknown): ScenePlan[] {
  if (typeof valueAt(body, "status") === "string" && valueAt(body, "status") !== "COMPLETED") {
    throw new Error(`Backboard status ${valueAt(body, "status")}: ${String(valueAt(body, "content") ?? "no content")}`);
  }

  const json = extractJsonObject(extractBackboardText(body));
  return normalizeScenePlans(json);
}

async function backboardModelCandidates(apiKey: string, includeDefault: boolean): Promise<BackboardModelCandidate[]> {
  const candidates = configuredBackboardModelCandidates();
  const validatedCandidates = shouldValidateBackboardModels()
    ? await filterJsonOutputModelCandidates(apiKey, candidates)
    : candidates;

  return includeDefault ? [...validatedCandidates, {}] : validatedCandidates;
}

function configuredBackboardModelCandidates(): BackboardModelCandidate[] {
  const configured = process.env.BACKBOARD_MODEL_CANDIDATES?.trim();
  const parsed = configured ? parseBackboardModelCandidates(configured) : [];

  if (parsed.length > 0) {
    return parsed;
  }

  return MODEL_CANDIDATES.map((modelName) => ({
    modelName,
    provider: "google"
  }));
}

function parseBackboardModelCandidates(value: string): BackboardModelCandidate[] {
  const candidates: BackboardModelCandidate[] = [];
  const seen = new Set<string>();

  for (const entry of value.split(",")) {
    const trimmed = entry.trim();

    if (!trimmed) {
      continue;
    }

    const [providerPart, ...modelParts] = trimmed.split(":");
    const provider = modelParts.length > 0 ? providerPart.trim() : "";
    const modelName = (modelParts.length > 0 ? modelParts.join(":") : providerPart).trim();

    if (!modelName) {
      continue;
    }

    const key = `${provider}:${modelName}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push({
      ...(provider ? { provider } : {}),
      modelName
    });
  }

  return candidates;
}

function shouldValidateBackboardModels(): boolean {
  return process.env.BACKBOARD_VALIDATE_MODELS?.trim().toLowerCase() === "true";
}

async function filterJsonOutputModelCandidates(
  apiKey: string,
  candidates: BackboardModelCandidate[]
): Promise<BackboardModelCandidate[]> {
  try {
    const models = await listJsonOutputBackboardModels(apiKey);
    const supported = new Set(
      models.map((model) => `${String(model.provider ?? "")}:${String(model.name ?? "")}`)
    );
    const filtered = candidates.filter((candidate) => supported.has(`${candidate.provider ?? ""}:${candidate.modelName ?? ""}`));

    return filtered.length > 0 ? filtered : candidates;
  } catch (error) {
    console.warn(`[Backboard] Model validation skipped: ${errorMessage(error)}`);
    return candidates;
  }
}

async function listJsonOutputBackboardModels(apiKey: string): Promise<BackboardModelRecord[]> {
  const url = new URL(BACKBOARD_MODELS_URL);
  url.searchParams.set("model_type", "llm");
  url.searchParams.set("supports_json_output", "true");
  url.searchParams.set("limit", "500");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_VALIDATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Backboard models ${response.status}`);
    }

    const body = await response.json();
    const models = Array.isArray(valueAt(body, "models")) ? valueAt(body, "models") : [];

    return (models as BackboardModelRecord[]).filter((model) => model.supports_json_output !== false);
  } finally {
    clearTimeout(timeout);
  }
}

async function postBackboardMessageWithRetry(options: BackboardRequestOptions): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await postBackboardMessage(options);
    } catch (error) {
      lastError = error;

      if (!isRetryableBackboardError(error) || attempt === MAX_RETRY_ATTEMPTS) {
        break;
      }

      await delay(350 * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Backboard request failed.");
}

async function postBackboardMessage({ apiKey, text, stream, candidate }: BackboardRequestOptions): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(BACKBOARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify({
        content: buildScenePlannerPrompt(text),
        system_prompt: SCENE_PLANNER_SYSTEM_PROMPT,
        ...(candidate.provider ? { llm_provider: candidate.provider } : {}),
        ...(candidate.modelName ? { model_name: candidate.modelName } : {}),
        memory: "off",
        web_search: "off",
        send_to_llm: "true",
        json_output: true,
        ...backboardThinkingPayload(),
        stream
      })
    });
  } catch (error) {
    throw new BackboardRequestError(`Backboard network error: ${errorMessage(error)}`, true);
  }

  if (!response.ok) {
    const detail = await response.text();
    const retryable = RETRYABLE_STATUS_CODES.has(response.status);
    throw new BackboardRequestError(`Backboard ${response.status}: ${detail.slice(0, 300)}`, retryable);
  }

  return response;
}

function backboardThinkingPayload(): { thinking: { effort: string } } | Record<string, never> {
  const effort = process.env.BACKBOARD_THINKING_EFFORT?.trim().toLowerCase();

  if (!effort || !THINKING_EFFORTS.has(effort)) {
    return {};
  }

  return {
    thinking: { effort }
  };
}

function isRetryableBackboardError(error: unknown): boolean {
  return error instanceof BackboardRequestError && error.retryable;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function extractBackboardText(body: unknown): string {
  const candidates = [
    body,
    valueAt(body, "content"),
    valueAt(body, "message"),
    valueAt(body, "message.content"),
    valueAt(body, "assistant_message"),
    valueAt(body, "assistant_message.content"),
    valueAt(body, "response"),
    valueAt(body, "data.content"),
    valueAt(body, "data.message.content")
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return JSON.stringify(body);
}

async function readBackboardStream(body: ReadableStream<Uint8Array>, options: BackboardStreamOptions): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const payloads: unknown[] = [];
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const separatorIndex = buffer.indexOf("\n\n");
      if (separatorIndex === -1) {
        break;
      }

      const frame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const parsed = parseSseFrame(frame);

      if (!parsed) {
        continue;
      }

      payloads.push(parsed.data);
      emitStreamDiagnostics(parsed.event, parsed.data, options);

      const chunk = extractBackboardStreamChunk(parsed.event, parsed.data);
      if (chunk) {
        content += chunk;
        options.onChunk?.(chunk);
      }
    }
  }

  const trailing = decoder.decode();
  if (trailing) {
    buffer += trailing;
  }

  if (buffer.trim()) {
    const parsed = parseSseFrame(buffer);
    if (parsed) {
      payloads.push(parsed.data);
      emitStreamDiagnostics(parsed.event, parsed.data, options);
      const chunk = extractBackboardStreamChunk(parsed.event, parsed.data);
      if (chunk) {
        content += chunk;
        options.onChunk?.(chunk);
      }
    }
  }

  if (content.trim()) {
    return content;
  }

  for (const payload of [...payloads].reverse()) {
    const text = extractBackboardText(payload);
    if (text.trim()) {
      return text;
    }
  }

  return "";
}

function parseSseFrame(frame: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.join("\n");
  if (data === "[DONE]") {
    return null;
  }

  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}

function extractBackboardStreamChunk(event: string, data: unknown): string {
  if (backboardStreamEventType(event, data) !== "content_streaming") {
    return "";
  }

  const candidates = [
    data,
    valueAt(data, "content"),
    valueAt(data, "delta"),
    valueAt(data, "text"),
    valueAt(data, "chunk"),
    valueAt(data, "data.content"),
    valueAt(data, "message.content")
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) {
      return candidate;
    }
  }

  return "";
}

function emitStreamDiagnostics(event: string, data: unknown, options: BackboardStreamOptions) {
  if (backboardStreamEventType(event, data) !== "run_ended") {
    return;
  }

  const diagnostics = extractBackboardDiagnostics(data);

  if (Object.keys(diagnostics).length > 0) {
    options.onDiagnostics?.(diagnostics);
  }
}

function backboardStreamEventType(event: string, data: unknown): string {
  const payloadType = valueAt(data, "type");
  return typeof payloadType === "string" && payloadType ? payloadType : event;
}

function extractBackboardDiagnostics(body: unknown): BackboardDiagnostics {
  const diagnostics: BackboardDiagnostics = {};
  const provider = firstString(body, ["model_provider", "provider", "llm_provider", "data.model_provider"]);
  const modelName = firstString(body, ["model_name", "model", "data.model_name"]);
  const status = firstString(body, ["status", "data.status"]);
  const threadId = firstString(body, ["thread_id", "threadId", "data.thread_id"]);
  const messageId = firstString(body, ["message_id", "messageId", "data.message_id"]);
  const runId = firstString(body, ["run_id", "runId", "data.run_id"]);
  const inputTokens = firstNumber(body, ["input_tokens", "usage.input_tokens", "data.input_tokens"]);
  const outputTokens = firstNumber(body, ["output_tokens", "usage.output_tokens", "data.output_tokens"]);
  const contextUsage = firstNumber(body, ["context_usage", "usage.context_usage", "data.context_usage"]);

  if (provider) diagnostics.provider = provider;
  if (modelName) diagnostics.modelName = modelName;
  if (status) diagnostics.status = status;
  if (threadId) diagnostics.threadId = threadId;
  if (messageId) diagnostics.messageId = messageId;
  if (runId) diagnostics.runId = runId;
  if (inputTokens !== undefined) diagnostics.inputTokens = inputTokens;
  if (outputTokens !== undefined) diagnostics.outputTokens = outputTokens;
  if (contextUsage !== undefined) diagnostics.contextUsage = contextUsage;

  return diagnostics;
}

function firstString(value: unknown, paths: string[]): string | undefined {
  for (const path of paths) {
    const candidate = valueAt(value, path);

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function firstNumber(value: unknown, paths: string[]): number | undefined {
  for (const path of paths) {
    const candidate = valueAt(value, path);

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }

    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function logBackboardDiagnostics(diagnostics: BackboardDiagnostics) {
  if (Object.keys(diagnostics).length === 0) {
    return;
  }

  const fields = [
    diagnostics.provider || diagnostics.modelName
      ? `model=${[diagnostics.provider, diagnostics.modelName].filter(Boolean).join("/")}`
      : "",
    diagnostics.status ? `status=${diagnostics.status}` : "",
    diagnostics.inputTokens !== undefined ? `input_tokens=${diagnostics.inputTokens}` : "",
    diagnostics.outputTokens !== undefined ? `output_tokens=${diagnostics.outputTokens}` : "",
    diagnostics.contextUsage !== undefined ? `context_usage=${diagnostics.contextUsage}` : "",
    diagnostics.threadId ? `thread_id=${diagnostics.threadId}` : "",
    diagnostics.messageId ? `message_id=${diagnostics.messageId}` : "",
    diagnostics.runId ? `run_id=${diagnostics.runId}` : ""
  ].filter(Boolean);

  console.info(`[Backboard] ${fields.join(" ")}`);
}

function valueAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (typeof current === "object" && current !== null && key in current) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, value);
}

export function getBackboardFallbackScenes(): ScenePlan[] {
  return demoScenes;
}

export const __backboardTestExports = {
  backboardThinkingPayload,
  extractBackboardDiagnostics,
  extractBackboardStreamChunk,
  filterJsonOutputModelCandidates,
  parseBackboardModelCandidates,
  readBackboardStream
};
