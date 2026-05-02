import { demoScenes } from "./demoData";
import { buildScenePlannerPrompt, extractJsonObject, SCENE_PLANNER_SYSTEM_PROMPT } from "./scenePrompt";
import { normalizeScenePlans, type ScenePlan } from "./sceneSchema";

const BACKBOARD_URL = "https://app.backboard.io/api/threads/messages";
const MODEL_CANDIDATES = ["gemini-3-flash-preview", "gemini-2.5-flash"];
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const MAX_RETRY_ATTEMPTS = 3;

type BackboardModelCandidate = {
  modelName?: string;
  provider?: string;
};

type BackboardStreamOptions = {
  onChunk?: (chunk: string) => void;
};

type BackboardRequestOptions = {
  apiKey: string;
  text: string;
  stream: boolean;
  candidate: BackboardModelCandidate;
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

  for (const candidate of backboardModelCandidates(true)) {
    try {
      const response = await postBackboardMessageWithRetry({
        apiKey,
        text,
        stream: false,
        candidate
      });
      const body = await response.json();
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

  for (const candidate of backboardModelCandidates(false)) {
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

      const streamedText = await readBackboardStream(response.body, options);
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

  for (const candidate of backboardModelCandidates(true)) {
    try {
      const response = await postBackboardMessageWithRetry({
        apiKey,
        text,
        stream: false,
        candidate
      });
      const body = await response.json();
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

function backboardModelCandidates(includeDefault: boolean): BackboardModelCandidate[] {
  const candidates = MODEL_CANDIDATES.map((modelName) => ({
    modelName,
    provider: "google"
  }));

  return includeDefault ? [...candidates, {}] : candidates;
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
  if (event !== "content_streaming") {
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
