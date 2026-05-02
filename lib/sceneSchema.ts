import { z } from "zod";

export const layoutTypes = [
  "interior_room",
  "open_clearing",
  "corridor_path",
  "exhibit_space"
] as const;

export const moods = [
  "warm",
  "mysterious",
  "tense",
  "melancholic",
  "wonder",
  "neutral"
] as const;

export const visualTypes = [
  "book",
  "letter",
  "key",
  "clock",
  "door",
  "portrait",
  "artifact",
  "sign",
  "tree",
  "lamp",
  "memory_orb",
  "generic"
] as const;

export const slots = [
  "center",
  "left",
  "right",
  "back",
  "table",
  "floor",
  "wall"
] as const;

export const sourceAnchorSchema = z.object({
  quote: z.string().min(1),
  page: z.number().int().positive().optional(),
  meaning: z.string().min(1)
});

export const sceneObjectSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  visualType: z.enum(visualTypes).catch("generic"),
  description: z.string().min(1),
  quote: z.string().min(1),
  explanation: z.string().min(1),
  slot: z.enum(slots).catch("center")
});

export const scenePlanSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  layoutType: z.enum(layoutTypes).catch("exhibit_space"),
  dressing: z.string().min(1),
  mood: z.enum(moods).catch("neutral"),
  stylePrompt: z.string().min(1),
  narration: z.string().min(1),
  sourceAnchors: z.array(sourceAnchorSchema).default([]),
  objects: z.array(sceneObjectSchema).min(1).max(3),
  transitionToNext: z.object({
    label: z.string().min(1),
    description: z.string().min(1)
  })
});

export const scenesResponseSchema = z.object({
  scenes: z.array(scenePlanSchema).min(1).max(3)
});

export type ScenePlan = z.infer<typeof scenePlanSchema>;
export type SceneObject = z.infer<typeof sceneObjectSchema>;
export type LayoutType = ScenePlan["layoutType"];
export type Mood = ScenePlan["mood"];

const fallbackObject: SceneObject = {
  id: "memory",
  label: "Memory shard",
  visualType: "memory_orb",
  description: "A glowing source fragment from the document.",
  quote: "No source quote was available.",
  explanation: "This placeholder keeps the scene explorable when generation returned too little detail.",
  slot: "center"
};

export function normalizeScenePlans(input: unknown): ScenePlan[] {
  const rawScenes = extractScenes(input).slice(0, 3);
  const normalized = rawScenes.map((scene, sceneIndex) => {
    const raw = scene as Record<string, unknown>;
    const rawObjects = Array.isArray(raw.objects) ? raw.objects.slice(0, 3) : [];
    const objects = Array.from({ length: 3 }, (_, objectIndex) => {
      const candidate =
        (rawObjects[objectIndex] as Record<string, unknown> | undefined) ?? fallbackObject;

      return sceneObjectSchema.parse({
        ...fallbackObject,
        ...candidate,
        id: stringOrDefault(candidate.id, `scene-${sceneIndex + 1}-object-${objectIndex + 1}`),
        label: stringOrDefault(candidate.label, fallbackObject.label),
        quote: stringOrDefault(candidate.quote, fallbackObject.quote),
        explanation: stringOrDefault(candidate.explanation, fallbackObject.explanation),
        description: stringOrDefault(candidate.description, fallbackObject.description)
      });
    });

    return scenePlanSchema.parse({
      id: stringOrDefault(raw.id, `scene-${sceneIndex + 1}`),
      title: stringOrDefault(raw.title, `Scene ${sceneIndex + 1}`),
      summary: stringOrDefault(raw.summary, "A compact explorable scene generated from the document."),
      layoutType: raw.layoutType,
      dressing: stringOrDefault(raw.dressing, "a quiet memory-space shaped by the document"),
      mood: raw.mood,
      stylePrompt: stringOrDefault(
        raw.stylePrompt,
        "cinematic compact story museum scene, atmospheric lighting"
      ),
      narration: stringOrDefault(
        raw.narration,
        "The document gathers itself into a place you can walk through."
      ),
      sourceAnchors: Array.isArray(raw.sourceAnchors) ? raw.sourceAnchors : [],
      objects,
      transitionToNext:
        typeof raw.transitionToNext === "object" && raw.transitionToNext
          ? raw.transitionToNext
          : {
              label: sceneIndex === rawScenes.length - 1 ? "Return" : "Next threshold",
              description: "A glowing threshold leads onward."
            }
    });
  });

  return normalized.length > 0 ? normalized : [];
}

function extractScenes(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === "object" && input !== null && Array.isArray((input as { scenes?: unknown }).scenes)) {
    return (input as { scenes: unknown[] }).scenes;
  }

  return [];
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export const scenePlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scenes: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          layoutType: { type: "string", enum: layoutTypes },
          dressing: { type: "string" },
          mood: { type: "string", enum: moods },
          stylePrompt: { type: "string" },
          narration: { type: "string" },
          sourceAnchors: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                quote: { type: "string" },
                page: { type: "number" },
                meaning: { type: "string" }
              },
              required: ["quote", "meaning"]
            }
          },
          objects: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                visualType: { type: "string", enum: visualTypes },
                description: { type: "string" },
                quote: { type: "string" },
                explanation: { type: "string" },
                slot: { type: "string", enum: slots }
              },
              required: ["id", "label", "visualType", "description", "quote", "explanation", "slot"]
            }
          },
          transitionToNext: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              description: { type: "string" }
            },
            required: ["label", "description"]
          }
        },
        required: [
          "id",
          "title",
          "summary",
          "layoutType",
          "dressing",
          "mood",
          "stylePrompt",
          "narration",
          "sourceAnchors",
          "objects",
          "transitionToNext"
        ]
      }
    }
  },
  required: ["scenes"]
} as const;

