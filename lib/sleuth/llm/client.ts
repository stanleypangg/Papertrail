import { requireEnv } from "@/lib/sleuth/env";

const BACKBOARD_URL = "https://app.backboard.io/api/threads/messages";
const BACKBOARD_PROVIDER = "google";
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const FALLBACK_LINE = "...the room falls silent for a long moment.";

export interface SleuthChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamHostOptions {
  onChunk?: (chunk: string) => void;
}

interface BackboardRequestOptions {
  systemPrompt: string;
  content: string;
  modelName: string;
  stream: boolean;
  onChunk?: (chunk: string) => void;
}

class BackboardRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "BackboardRequestError";
  }
}

export async function streamHost(
  systemPrompt: string,
  messages: SleuthChatMessage[],
  options: StreamHostOptions = {},
): Promise<string> {
  return runBackboardRequest({
    systemPrompt,
    content: formatConversation(messages),
    modelName: requireEnv("SLEUTH_MODEL_PROSE"),
    stream: true,
    onChunk: options.onChunk,
  });
}

export async function npcReply(
  npcId: string,
  systemPrompt: string,
  history: SleuthChatMessage[],
  userMessage: string,
): Promise<string> {
  const messages: SleuthChatMessage[] = [
    ...history,
    { role: "user", content: `NPC ${npcId}: ${userMessage}` },
  ];

  return runBackboardRequest({
    systemPrompt,
    content: formatConversation(messages),
    modelName: requireEnv("SLEUTH_MODEL_FAST"),
    stream: false,
  });
}

async function runBackboardRequest(options: BackboardRequestOptions): Promise<string> {
  try {
    return await postBackboardMessageWithRetry(options);
  } catch {
    return FALLBACK_LINE;
  }
}

async function postBackboardMessageWithRetry(
  options: BackboardRequestOptions,
): Promise<string> {
  const apiKey = requireEnv("BACKBOARD_API_KEY");
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await postBackboardMessage(apiKey, options);
      return await readBackboardResponse(response, options);
    } catch (error) {
      lastError = error;

      if (!(error instanceof BackboardRequestError) || !error.retryable || attempt === 2) {
        break;
      }

      await delay(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Backboard request failed.");
}

async function postBackboardMessage(
  apiKey: string,
  options: BackboardRequestOptions,
): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(BACKBOARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        content: options.content,
        system_prompt: options.systemPrompt,
        llm_provider: BACKBOARD_PROVIDER,
        model_name: options.modelName,
        memory: "off",
        web_search: "off",
        send_to_llm: "true",
        json_output: false,
        stream: options.stream,
      }),
    });
  } catch (error) {
    throw new BackboardRequestError(`Backboard network error: ${errorMessage(error)}`, true);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new BackboardRequestError(
      `Backboard ${response.status}: ${detail.slice(0, 300)}`,
      RETRYABLE_STATUS_CODES.has(response.status),
    );
  }

  return response;
}

async function readBackboardResponse(
  response: Response,
  options: BackboardRequestOptions,
): Promise<string> {
  if (options.stream && response.body) {
    const streamed = await readBackboardStream(response.body, options.onChunk);
    if (streamed.trim()) {
      return streamed;
    }
  }

  const body = await response.json();
  return extractBackboardText(body);
}

function formatConversation(messages: SleuthChatMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

function extractBackboardText(body: unknown): string {
  const candidates = [
    body,
    valueAt(body, "body.content"),
    valueAt(body, "body.message"),
    valueAt(body, "body.message.content"),
    valueAt(body, "content"),
    valueAt(body, "message"),
    valueAt(body, "message.content"),
    valueAt(body, "assistant_message"),
    valueAt(body, "assistant_message.content"),
    valueAt(body, "response"),
    valueAt(body, "data.content"),
    valueAt(body, "data.message.content"),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return FALLBACK_LINE;
}

async function readBackboardStream(
  body: ReadableStream<Uint8Array>,
  onChunk?: (chunk: string) => void,
): Promise<string> {
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
        onChunk?.(chunk);
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
        onChunk?.(chunk);
      }
    }
  }

  if (content.trim()) {
    return content;
  }

  for (const payload of [...payloads].reverse()) {
    const text = extractBackboardText(payload);
    if (text.trim() && text !== FALLBACK_LINE) {
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
      continue;
    }
    if (line.startsWith("data:")) {
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
    valueAt(data, "message.content"),
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
