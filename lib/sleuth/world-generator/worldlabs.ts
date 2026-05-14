import { requireEnv } from "@/lib/sleuth/env";
import type {
  GenerateInput,
  GenerateResult,
  MarbleGetOperationResponse,
  MarbleWorldsGenerateRequest,
  PollResult,
  WorldGenerator,
} from "./types";
import {
  MarbleAuthError,
  MarbleOperationError,
  MarbleRateLimitError,
  MarbleServerError,
} from "./types";

export const MARBLE_BASE_URL = "https://api.worldlabs.ai/marble/v1";
export const MARBLE_GENERATE_PATH = "/worlds:generate";
export const MARBLE_OPERATIONS_PATH = "/operations";
export const MARBLE_MODEL = "marble-1.0-draft";
export const MARBLE_RETRY_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface FetchAttempt {
  response?: Response;
  networkError?: unknown;
}

async function fetchOnce(
  url: string,
  init: RequestInit,
): Promise<FetchAttempt> {
  try {
    const response = await fetch(url, init);
    return { response };
  } catch (error) {
    return { networkError: error };
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const first = await fetchOnce(url, init);
  const shouldRetry =
    first.networkError !== undefined ||
    (first.response !== undefined && first.response.status >= 500);

  if (!shouldRetry && first.response) {
    return first.response;
  }

  await delay(MARBLE_RETRY_DELAY_MS);

  const second = await fetchOnce(url, init);
  if (second.response) {
    return second.response;
  }
  throw second.networkError instanceof Error
    ? second.networkError
    : new Error("Marble fetch failed with unknown network error");
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function mapNon2xxToError(response: Response, context: string): Promise<never> {
  const body = await readBody(response);
  const suffix = body.length > 0 ? ` body=${body}` : "";
  if (response.status === 401) {
    throw new MarbleAuthError(`Marble ${context} unauthorized (401).${suffix}`);
  }
  if (response.status === 429) {
    throw new MarbleRateLimitError(
      `Marble ${context} rate limited (429).${suffix}`,
    );
  }
  if (response.status >= 500) {
    throw new MarbleServerError(
      `Marble ${context} server error (${response.status}).${suffix}`,
    );
  }
  throw new MarbleServerError(
    `Marble ${context} failed (${response.status}).${suffix}`,
  );
}

function buildGenerateBody(input: GenerateInput): MarbleWorldsGenerateRequest {
  const body: MarbleWorldsGenerateRequest = {
    model: MARBLE_MODEL,
    permission: {
      allow_id_access: false,
      public: false,
    },
    world_prompt: {
      type: "text",
      text_prompt: input.world_prompt.text_prompt,
      disable_recaption: input.world_prompt.disable_recaption ?? null,
    },
  };
  if (input.display_name !== undefined) {
    body.display_name = input.display_name;
  }
  return body;
}

function extractSplatUrl(response: MarbleGetOperationResponse): string | undefined {
  const payload = response.response;
  if (!payload || !("assets" in payload)) {
    return undefined;
  }
  const assets = payload.assets;
  if (!assets) {
    return undefined;
  }
  const splats = assets.splats;
  if (!splats) {
    return undefined;
  }
  const urls = splats.spz_urls;
  if (!urls) {
    return undefined;
  }
  for (const value of Object.values(urls)) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export async function generateWorld(
  input: GenerateInput,
): Promise<GenerateResult> {
  const apiKey = requireEnv("WLT_API_KEY");
  const url = `${MARBLE_BASE_URL}${MARBLE_GENERATE_PATH}`;
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": apiKey,
    },
    body: JSON.stringify(buildGenerateBody(input)),
  };

  const response = await fetchWithRetry(url, init);
  if (!response.ok) {
    await mapNon2xxToError(response, "generate");
  }

  const data = (await response.json()) as { operation_id?: string };
  if (!data.operation_id) {
    throw new MarbleServerError(
      "Marble generate response missing operation_id.",
    );
  }
  return { operation_id: data.operation_id };
}

export async function pollOperation(operation_id: string): Promise<PollResult> {
  const apiKey = requireEnv("WLT_API_KEY");
  const url = `${MARBLE_BASE_URL}${MARBLE_OPERATIONS_PATH}/${operation_id}`;
  const init: RequestInit = {
    method: "GET",
    headers: {
      "WLT-Api-Key": apiKey,
    },
  };

  const response = await fetchWithRetry(url, init);

  if (response.status === 404) {
    throw new MarbleOperationError(
      `Marble operation ${operation_id} not found (expired).`,
      "expired",
    );
  }

  if (!response.ok) {
    await mapNon2xxToError(response, "poll");
  }

  const data = (await response.json()) as MarbleGetOperationResponse;

  if (data.error) {
    const message = data.error.message ?? "operation failed";
    throw new MarbleOperationError(
      `Marble operation ${operation_id} failed: ${message}`,
    );
  }

  if (!data.done) {
    return { done: false };
  }

  const splat_url = extractSplatUrl(data);
  if (!splat_url) {
    throw new MarbleOperationError(
      `Marble operation ${operation_id} done but no splat assets present.`,
      "no-assets",
    );
  }

  return { done: true, splat_url };
}

export class WorldlabsProvider implements WorldGenerator {
  generate(input: GenerateInput): Promise<GenerateResult> {
    return generateWorld(input);
  }

  poll(operation_id: string): Promise<PollResult> {
    return pollOperation(operation_id);
  }
}
