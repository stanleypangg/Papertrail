import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

import { requireEnv } from "@/lib/sleuth/env";

const STYLE_SUFFIX =
  " Painted character portrait. Ink wash, 1920s Shanghai, cinnabar accent," +
  " oil-lamp warmth, vintage propaganda-poster style. Square crop, head and" +
  " shoulders, faintly luminous against dark ink background.";

const IMAGE_MODELS = ["gpt-image-1", "dall-e-3"] as const;

export interface GeneratePortraitInput {
  characterName: string;
  publicBrief: string;
  scriptMood: string;
  outPath: string;
}

type SupportedImageModel = (typeof IMAGE_MODELS)[number];

export async function generatePortrait(input: GeneratePortraitInput): Promise<string> {
  if (fs.existsSync(input.outPath)) {
    return input.outPath;
  }

  fs.mkdirSync(path.dirname(input.outPath), { recursive: true });

  const client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  const prompt = buildPortraitPrompt(input);
  let lastError: unknown;

  for (const model of IMAGE_MODELS) {
    try {
      const response = await client.images.generate({
        model,
        prompt,
        n: 1,
        size: "1024x1024",
      });
      const bytes = await imageBytesFromResponse(response);
      fs.writeFileSync(input.outPath, bytes);
      return input.outPath;
    } catch (error) {
      lastError = error;
      if (!isModelAccessError(error, model) || model === "dall-e-3") {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Image generation failed.");
}

function buildPortraitPrompt(input: GeneratePortraitInput): string {
  return [
    `${input.characterName}.`,
    input.publicBrief,
    input.scriptMood,
    STYLE_SUFFIX,
  ].join(" ");
}

async function imageBytesFromResponse(
  response: Awaited<ReturnType<OpenAI["images"]["generate"]>>,
): Promise<Buffer> {
  if (!("data" in response) || !Array.isArray(response.data)) {
    throw new Error("OpenAI returned a streaming image response unexpectedly.");
  }

  const image = response.data[0];

  if (!image) {
    throw new Error("OpenAI returned no image.");
  }

  if ("b64_json" in image && typeof image.b64_json === "string" && image.b64_json.length > 0) {
    return Buffer.from(image.b64_json, "base64");
  }

  if ("url" in image && typeof image.url === "string" && image.url.length > 0) {
    const remote = await fetch(image.url);
    if (!remote.ok) {
      throw new Error(`Image download failed with status ${remote.status}.`);
    }
    return Buffer.from(await remote.arrayBuffer());
  }

  throw new Error("OpenAI returned no usable image payload.");
}

function isModelAccessError(error: unknown, model: SupportedImageModel): boolean {
  const status = getErrorStatus(error);
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (status === 403) {
    return message.includes(model) || message.includes("does not have access");
  }

  if (status === 404) {
    return message.includes("model") || message.includes(model);
  }

  if (status === 400) {
    return (
      message.includes("unsupported") ||
      message.includes("invalid model") ||
      message.includes("unknown model") ||
      message.includes("does not exist")
    );
  }

  return false;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") {
      return status;
    }
  }

  return undefined;
}
