import { demoScenes } from "./demoData";
import { buildScenePlannerPrompt, extractJsonObject, SCENE_PLANNER_SYSTEM_PROMPT } from "./scenePrompt";
import { normalizeScenePlans, type ScenePlan } from "./sceneSchema";

const BACKBOARD_URL = "https://app.backboard.io/api/threads/messages";
const MODEL_CANDIDATES = ["gemini-3-flash-preview", "gemini-2.5-flash"];

export async function generateScenesWithBackboard(text: string): Promise<ScenePlan[]> {
  const apiKey = process.env.BACKBOARD_API_KEY;

  if (!apiKey) {
    throw new Error("BACKBOARD_API_KEY is missing.");
  }

  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const response = await fetch(BACKBOARD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({
          content: buildScenePlannerPrompt(text),
          system_prompt: SCENE_PLANNER_SYSTEM_PROMPT,
          llm_provider: "google",
          model_name: modelName,
          memory: "off",
          web_search: "off",
          send_to_llm: "true",
          json_output: true,
          stream: false
        })
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Backboard ${response.status}: ${detail.slice(0, 300)}`);
      }

      const body = await response.json();
      if (typeof valueAt(body, "status") === "string" && valueAt(body, "status") !== "COMPLETED") {
        throw new Error(`Backboard status ${valueAt(body, "status")}: ${String(valueAt(body, "content") ?? "no content")}`);
      }

      const json = extractJsonObject(extractBackboardText(body));
      const scenes = normalizeScenePlans(json);

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
