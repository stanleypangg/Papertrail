import OpenAI from "openai";

const imageModels = ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini", "dall-e-3", "dall-e-2"] as const;
type SupportedImageModel = (typeof imageModels)[number];

const DEFAULT_IMAGE_MODEL: SupportedImageModel = "gpt-image-1.5";

export async function generateSceneConceptImage(prompt: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = getImageModel();
  const response = await client.images.generate({
    model,
    prompt: [
      prompt,
      "Create a wide first-person 360 panoramic environment from the viewer's eye level. The viewer stands at the center of the scene and can look left, right, up, and down. Make it feel like an explorable immersive story space with coherent surrounding architecture or landscape. No text, captions, UI, controls, frames, logos, split panels, or borders."
    ].join(" "),
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
    return image.url;
  }

  return null;
}

function getImageModel(): SupportedImageModel {
  const configured = process.env.OPENAI_IMAGE_MODEL?.trim();

  if (configured && imageModels.includes(configured as SupportedImageModel)) {
    return configured as SupportedImageModel;
  }

  return DEFAULT_IMAGE_MODEL;
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
