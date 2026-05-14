import type { ScenePlan } from "./sceneSchema";

const OPENROUTER_IMAGE_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_IMAGE_MODEL = "openai/gpt-5.4-image-2";
const IMAGE_ASPECT_RATIO = "16:9";
const IMAGE_SIZE = "2K";

type ImageGenerationMode = "preview" | "scene-mural";

type GenerateSceneConceptImageOptions = {
  mode?: ImageGenerationMode;
};

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{
        image_url?: {
          url?: string;
        };
        imageUrl?: {
          url?: string;
        };
      }>;
    };
  }>;
};

export const IMAGE_GENERATION_UNAVAILABLE_WARNING = "OPENROUTER_API_KEY missing or no image returned; skipped scene mural.";

export async function generateSceneConceptImage(
  prompt: string,
  options: GenerateSceneConceptImageOptions = {}
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return null;
  }

  const mode = options.mode ?? "preview";
  const imagePrompt = buildImagePrompt(prompt, mode);

  const response = await fetch(OPENROUTER_IMAGE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENROUTER_IMAGE_MODEL,
      messages: [
        {
          role: "user",
          content: imagePrompt
        }
      ],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: IMAGE_ASPECT_RATIO,
        image_size: IMAGE_SIZE
      },
      stream: false
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenRouter image generation ${response.status}: ${detail.slice(0, 300)}`);
  }

  const body = await response.json() as OpenRouterImageResponse;
  return extractOpenRouterImageUrl(body);
}

export async function generateSceneMuralImage(scene: ScenePlan): Promise<string | null> {
  return generateSceneConceptImage(buildSceneMuralSourcePrompt(scene), { mode: "scene-mural" });
}

function extractOpenRouterImageUrl(body: OpenRouterImageResponse): string | null {
  const images = body.choices?.[0]?.message?.images;
  const imageUrl = images?.[0]?.image_url?.url ?? images?.[0]?.imageUrl?.url;

  return imageUrl?.startsWith("data:image/") ? imageUrl : null;
}

function buildImagePrompt(prompt: string, mode: ImageGenerationMode): string {
  if (mode === "scene-mural") {
    return [
      prompt,
      "Create one wide image of a concrete physical location that a person could stand inside.",
      "The image must read as a real scene with visible floor or ground plane, foreground/midground/background depth, spatial boundaries, lighting sources, and navigable architecture or landscape.",
      "Make the location match the scene's architecture, landscape, color palette, mood, objects, and lighting.",
      "Compose it as a framed image surface, not as a surrounding panorama or skybox.",
      "Avoid abstract symbolism, floating collage elements, infographics, diagrams, title-card compositions, character posters, text-as-art, and pure mood boards.",
      "No fisheye distortion, 360-degree projection, pole stretching, text, captions, UI, controls, frames, logos, borders, or split panels."
    ].join(" ");
  }

  return [
    prompt,
    "Create wide first-person concept art for an explorable physical story location with coherent architecture or landscape, visible floor or ground, depth, and a clear place identity.",
    "Avoid abstract symbolism, infographics, diagrams, title-card compositions, and pure mood boards.",
    "No text, captions, UI, controls, frames, logos, split panels, or borders."
  ].join(" ");
}

function buildSceneMuralSourcePrompt(scene: ScenePlan): string {
  const objects = scene.objects
    .map((object) => `${object.label}: ${object.description}`)
    .join("; ");

  return [
    `Scene title: ${scene.title}.`,
    `Layout archetype: ${scene.layoutType}.`,
    `Physical location dressing: ${scene.dressing}.`,
    `Scene mood: ${scene.mood}.`,
    `Location-first visual prompt: ${scene.stylePrompt}.`,
    `Narrative context: ${scene.summary} ${scene.narration}`,
    `Visible grounded props: ${objects}.`
  ].join(" ");
}
