import { scenePlanJsonSchema } from "./sceneSchema";

export const SCENE_PLANNER_SYSTEM_PROMPT =
  "You are a scene planner for an application that turns PDFs into small explorable 3D story spaces. Your job is to convert document text into exactly 3 or fewer compact scenes that can be rendered using deterministic 3D layout archetypes. Prefer concrete visual objects, locations, characters, emotional beats, and transitions. Every interactable object should be grounded in the document using a quote or close source anchor. If the document is fiction, make scenes correspond to narrative beats. If the document is nonfiction, make scenes correspond to concept rooms or museum exhibits. Do not invent major facts. Choose one layoutType from: interior_room, open_clearing, corridor_path, exhibit_space. Return strict JSON only. No markdown.";

export function buildScenePlannerPrompt(text: string): string {
  return [
    "Convert the following PDF text into a JSON object with a scenes array.",
    "Use at most 3 scenes. Each scene must match this JSON schema:",
    JSON.stringify(scenePlanJsonSchema),
    "The scenes should feel like compact first-person explorable story spaces.",
    "Include concrete interactable objects, source-grounded quotes, explanations, layoutType, dressing, mood, narration, and transitionToNext.",
    "The user should never see the word template.",
    "PDF text:",
    text
  ].join("\n\n");
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error("Model response did not contain a JSON object.");
  }
}

