import OpenAI from "openai";

const imageModels = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini", "dall-e-3", "dall-e-2"] as const;
type SupportedImageModel = (typeof imageModels)[number];

const DEFAULT_IMAGE_MODEL: SupportedImageModel = "gpt-image-1.5";
const unavailableImageModels = new Set<SupportedImageModel>();

type ImageGenerationMode = "preview" | "scene-mural";

type GenerateSceneConceptImageOptions = {
  mode?: ImageGenerationMode;
};

export async function generateSceneConceptImage(
  prompt: string,
  options: GenerateSceneConceptImageOptions = {}
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const mode = options.mode ?? "preview";
  const imagePrompt = buildImagePrompt(prompt, mode);
  let lastError: unknown;

  for (const model of getImageModelCandidates()) {
    try {
      const response = await client.images.generate({
        model,
        prompt: imagePrompt,
        n: 1,
        size: getImageSize(model),
        ...(model.startsWith("gpt-image") ? { output_format: "png" as const, quality: "auto" as const } : {})
      });

      const image = response.data?.[0];

      if (!image) {
        return null;
      }

      if ("b64_json" in image && image.b64_json) {
        return `data:image/png;base64,${image.b64_json}`;
      }

      if ("url" in image && image.url) {
        return await remoteImageUrlToDataUrl(image.url);
      }

      return null;
    } catch (error) {
      lastError = error;

      if (!isModelFallbackError(error, model)) {
        throw error;
      }

      unavailableImageModels.add(model);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Image generation failed.");
}

async function remoteImageUrlToDataUrl(url: string): Promise<string | null> {
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
  if (!contentType.startsWith("image/")) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

function getImageModelCandidates(): SupportedImageModel[] {
  const configured = process.env.OPENAI_IMAGE_MODEL?.trim();
  const preferred = configured && imageModels.includes(configured as SupportedImageModel)
    ? configured as SupportedImageModel
    : DEFAULT_IMAGE_MODEL;

  return [preferred, ...imageModels.filter((model) => model !== preferred)].filter((model) => !unavailableImageModels.has(model));
}

function isModelFallbackError(error: unknown, model: SupportedImageModel): boolean {
  const status = getErrorStatus(error);
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (status === 403) {
    return message.includes(model.toLowerCase())
      || message.includes("organization must be verified")
      || message.includes("does not have access");
  }

  if (status === 404) {
    return message.includes("model") || message.includes(model.toLowerCase());
  }

  if (status === 400) {
    return message.includes("unsupported")
      || message.includes("invalid model")
      || message.includes("unknown model")
      || message.includes("does not exist");
  }

  return false;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

function buildImagePrompt(prompt: string, mode: ImageGenerationMode): string {
  if (mode === "scene-mural") {
    return [
      prompt,
      "Create one wide scene mural for a physical wall or window inside a real 3D story space.",
      "Make it atmospheric concept art that matches the scene's architecture, landscape, color palette, and lighting.",
      "Compose it as a framed image surface, not as a surrounding panorama or skybox.",
      "No fisheye distortion, 360-degree projection, pole stretching, text, captions, UI, controls, frames, logos, borders, or split panels."
    ].join(" ");
  }

  return [
    prompt,
    "Create wide first-person concept art for an explorable immersive story space with coherent architecture or landscape.",
    "No text, captions, UI, controls, frames, logos, split panels, or borders."
  ].join(" ");
}

function getImageSize(model: SupportedImageModel) {
  if (model.startsWith("gpt-image")) {
    return "1536x1024" as const;
  }

  if (model === "dall-e-3") {
    return "1792x1024" as const;
  }

  return "1024x1024" as const;
}
