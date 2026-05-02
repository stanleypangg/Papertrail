import { scenePlanJsonSchema } from "./sceneSchema";

export const SCENE_PLANNER_SYSTEM_PROMPT =
  "You are a scene planner for an application that turns PDFs into small explorable 3D story spaces. Your job is to convert document text into exactly 3 or fewer compact scenes that can be rendered using deterministic 3D layout archetypes. Every scene must be a physical place that a person could stand inside: a room, corridor, street, platform, clearing, courtyard, workshop, gallery, or other concrete location. Prefer concrete visual objects, locations, characters, emotional beats, and transitions. Every interactable object should be grounded in the document using a quote or close source anchor. If the document is fiction, make scenes correspond to narrative beats in literal or plausibly staged locations. If the document is nonfiction, make scenes correspond to physical concept rooms or museum exhibits, not abstract diagrams. Do not invent major facts. Choose one layoutType from: interior_room, open_clearing, corridor_path, exhibit_space. Return strict JSON only. No markdown.";

export function buildScenePlannerPrompt(text: string): string {
  return [
    "Convert the following PDF text into a JSON object with a scenes array.",
    "Use at most 3 scenes. Each scene must match this JSON schema:",
    JSON.stringify(scenePlanJsonSchema),
    "The scenes should feel like compact first-person explorable story spaces.",
    "Each scene must have a specific physical location with visible floor/ground, walls/skyline or boundaries, lighting, depth, and spatial landmarks.",
    "The stylePrompt must describe the physical place first, then its atmosphere. It must not be only symbolic, graphic, typographic, diagrammatic, or abstract concept art.",
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
    for (const candidate of findJsonObjectCandidates(trimmed)) {
      try {
        return JSON.parse(candidate);
      } catch {
        // Keep scanning; provider responses can include malformed tool/status JSON before the answer.
      }
    }

    throw new Error("Model response did not contain a JSON object.");
  }
}

function findJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        start = index;
      }

      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;

      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}
