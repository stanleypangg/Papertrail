import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { extractJsonObject } from "./scenePrompt";
import type { ScenePlan } from "./sceneSchema";

export type CaptionCue = {
  end: number;
  start: number;
  text: string;
};

export type SceneNarrationResult = {
  audioUrl: string | null;
  captions: CaptionCue[];
  modelId: string;
  sceneId: string;
  script: string;
  voiceId: string | null;
  warning?: string;
};

type ElevenLabsAlignment = {
  characters?: unknown;
  character_start_times_seconds?: unknown;
  character_end_times_seconds?: unknown;
};

type ElevenLabsTimestampResponse = {
  audio_base64?: unknown;
  alignment?: ElevenLabsAlignment | null;
  normalized_alignment?: ElevenLabsAlignment | null;
};

type FetchLike = typeof fetch;

const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const ELEVENLABS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const BACKBOARD_URL = "https://app.backboard.io/api/threads/messages";
const LONG_DESCRIPTION_PROMPT_VERSION = "scene-long-description-v1";
const DEMO_NARRATION_DIR = path.join(process.cwd(), "public", "demo", "narration");
const DEMO_NARRATION_MANIFEST = path.join(DEMO_NARRATION_DIR, "manifest.json");

type SceneNarrationGlobal = typeof globalThis & {
  __pageWorldLongDescriptionCache?: Map<string, string>;
  __pageWorldNarrationCache?: Map<string, SceneNarrationResult>;
  __pageWorldInFlightNarrations?: Map<string, Promise<SceneNarrationResult>>;
};

const globalNarrationCache = globalThis as SceneNarrationGlobal;
const longDescriptionCache = globalNarrationCache.__pageWorldLongDescriptionCache ?? new Map<string, string>();
const narrationCache = globalNarrationCache.__pageWorldNarrationCache ?? new Map<string, SceneNarrationResult>();
const inFlightNarrations = globalNarrationCache.__pageWorldInFlightNarrations ?? new Map<string, Promise<SceneNarrationResult>>();

globalNarrationCache.__pageWorldLongDescriptionCache = longDescriptionCache;
globalNarrationCache.__pageWorldNarrationCache = narrationCache;
globalNarrationCache.__pageWorldInFlightNarrations = inFlightNarrations;

type SceneNarrationProviderConfig = {
  apiKey: string | null;
  apiKeyPresent: boolean;
  modelId: string;
  voiceId: string | null;
};

type CachedSceneNarration = SceneNarrationResult & {
  cacheState: "hit" | "miss" | "pending";
};

type DemoNarrationManifestEntry = {
  audioPath: string | null;
  cachedAt: string;
  captions: CaptionCue[];
  longDescriptionCacheKey: string;
  modelId: string;
  narrationCacheKey: string;
  script: string;
  voiceId: string | null;
  warning?: string;
};

type DemoNarrationManifest = Record<string, DemoNarrationManifestEntry>;

type PrepareSceneNarrationsOptions = {
  fetchImpl?: FetchLike;
  mode?: "runtime" | "demo-cache-build" | "demo-readonly";
  onProgress?: (progress: { completed: number; scene: ScenePlan; total: number; warning?: string }) => void;
  /**
   * @deprecated Use mode: "demo-cache-build" for the explicit cache-builder path.
   */
  persistDemo?: boolean;
};

export type PrepareSceneNarrationsResult = {
  scenes: ScenePlan[];
  warnings: string[];
};

export function selectSceneNarrationScript(scene: ScenePlan): string {
  return scene.integrations?.narration?.script?.trim() || scene.narration.trim();
}

export function sceneNarrationProviderConfig(): SceneNarrationProviderConfig {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() || null;

  return {
    apiKey,
    apiKeyPresent: Boolean(apiKey),
    modelId: process.env.ELEVENLABS_MODEL_ID?.trim() || ELEVENLABS_MODEL_ID,
    voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || null
  };
}

export function sceneNarrationCacheKey(scene: ScenePlan): string {
  const config = sceneNarrationProviderConfig();

  return JSON.stringify({
    sceneId: scene.id,
    script: selectSceneNarrationScript(scene),
    voiceId: config.voiceId,
    modelId: config.modelId,
    apiKeyPresent: config.apiKeyPresent
  });
}

export async function getCachedSceneNarration(scene: ScenePlan, fetchImpl: FetchLike = fetch): Promise<CachedSceneNarration> {
  const cacheKey = sceneNarrationCacheKey(scene);
  const cached = narrationCache.get(cacheKey);

  if (cached) {
    return { ...cached, cacheState: "hit" };
  }

  const pending = inFlightNarrations.get(cacheKey);

  if (pending) {
    return { ...await pending, cacheState: "pending" };
  }

  const narrationPromise = generateSceneNarration(scene, fetchImpl);
  inFlightNarrations.set(cacheKey, narrationPromise);

  try {
    const narration = await narrationPromise;
    narrationCache.set(cacheKey, narration);
    return { ...narration, cacheState: "miss" };
  } finally {
    inFlightNarrations.delete(cacheKey);
  }
}

export async function prepareSceneNarrations(
  scenes: ScenePlan[],
  options: PrepareSceneNarrationsOptions = {}
): Promise<PrepareSceneNarrationsResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const mode = options.mode ?? (options.persistDemo ? "demo-cache-build" : "runtime");
  const warnings: string[] = [];
  const targetScenes = mode === "demo-readonly" || mode === "demo-cache-build" ? scenes : scenes.slice(1);
  let completed = 0;

  async function prepareOne(scene: ScenePlan, index: number): Promise<ScenePlan> {
    if (mode === "runtime" && index === 0) {
      return scene;
    }

    try {
      if (mode === "demo-readonly") {
        const preparedScene = await hydrateDemoSceneNarration(scene);
        const warning = preparedScene.integrations?.narration?.warning;

        if (warning) {
          warnings.push(`${preparedScene.title}: ${warning}`);
        }

        completed += 1;
        options.onProgress?.({ completed, scene: preparedScene, total: targetScenes.length, warning });
        return preparedScene;
      }

      const script = await getLongSceneDescription(scene, fetchImpl);
      const sceneWithScript = withNarrationIntegration(scene, {
        audioUrl: scene.integrations?.narration?.audioUrl ?? null,
        captions: scene.integrations?.narration?.captions,
        modelId: scene.integrations?.narration?.modelId,
        script,
        voiceId: scene.integrations?.narration?.voiceId,
        warning: scene.integrations?.narration?.warning
      });
      const preparedScene = mode === "demo-cache-build"
        ? await prepareDemoSceneNarration(sceneWithScript, fetchImpl)
        : withNarrationResult(sceneWithScript, await getCachedSceneNarration(sceneWithScript, fetchImpl));
      const warning = preparedScene.integrations?.narration?.warning;

      if (warning) {
        warnings.push(`${preparedScene.title}: ${warning}`);
      }

      completed += 1;
      options.onProgress?.({ completed, scene: preparedScene, total: targetScenes.length, warning });
      return preparedScene;
    } catch (error) {
      const warning = error instanceof Error ? error.message : "Scene narration failed.";
      const fallbackScript = buildFallbackLongSceneDescription(scene);
      const fallbackScene = withNarrationIntegration(scene, {
        audioUrl: null,
        captions: estimateCaptionCues(fallbackScript),
        modelId: sceneNarrationProviderConfig().modelId,
        script: fallbackScript,
        voiceId: sceneNarrationProviderConfig().voiceId,
        warning
      });

      warnings.push(`${scene.title}: ${warning}`);
      completed += 1;
      options.onProgress?.({ completed, scene: fallbackScene, total: targetScenes.length, warning });
      return fallbackScene;
    }
  }

  const preparedScenes = mode === "demo-cache-build"
    ? []
    : await Promise.all(scenes.map(prepareOne));

  if (mode === "demo-cache-build") {
    for (let index = 0; index < scenes.length; index += 1) {
      const scene = scenes[index];

      if (scene) {
        preparedScenes.push(await prepareOne(scene, index));
      }
    }
  }

  return { scenes: preparedScenes, warnings };
}

export async function hydrateDemoSceneNarrations(scenes: ScenePlan[]): Promise<PrepareSceneNarrationsResult> {
  return prepareSceneNarrations(scenes, { mode: "demo-readonly" });
}

export async function generateSceneNarration(scene: ScenePlan, fetchImpl: FetchLike = fetch): Promise<SceneNarrationResult> {
  const script = selectSceneNarrationScript(scene);
  const config = sceneNarrationProviderConfig();
  const voiceId = config.voiceId;
  const modelId = config.modelId;
  const baseResult = {
    modelId,
    sceneId: scene.id,
    script,
    voiceId
  };

  if (!config.apiKey || !voiceId) {
    return {
      ...baseResult,
      audioUrl: null,
      captions: estimateCaptionCues(script),
      warning: "ElevenLabs narration is unavailable because ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is missing."
    };
  }

  try {
    const response = await fetchImpl(
      `${ELEVENLABS_ENDPOINT}/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": config.apiKey
        },
        body: JSON.stringify({
          model_id: modelId,
          text: script
        })
      }
    );

    if (!response.ok) {
      return {
        ...baseResult,
        audioUrl: null,
        captions: estimateCaptionCues(script),
        warning: `ElevenLabs narration failed with status ${response.status}.`
      };
    }

    const body = (await response.json()) as ElevenLabsTimestampResponse;
    const audioBase64 = typeof body.audio_base64 === "string" ? body.audio_base64 : "";
    const captions = captionCuesFromAlignment(body.normalized_alignment ?? body.alignment ?? null, script);

    if (!audioBase64) {
      return {
        ...baseResult,
        audioUrl: null,
        captions,
        warning: "ElevenLabs returned no audio for this scene."
      };
    }

    return {
      ...baseResult,
      audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
      captions
    };
  } catch (error) {
    return {
      ...baseResult,
      audioUrl: null,
      captions: estimateCaptionCues(script),
      warning: error instanceof Error ? error.message : "ElevenLabs narration failed."
    };
  }
}

export function longSceneDescriptionCacheKey(scene: ScenePlan): string {
  return stableHash({
    version: LONG_DESCRIPTION_PROMPT_VERSION,
    id: scene.id,
    title: scene.title,
    summary: scene.summary,
    dressing: scene.dressing,
    mood: scene.mood,
    narration: scene.narration,
    objects: scene.objects.map((object) => ({
      label: object.label,
      description: object.description,
      quote: object.quote,
      explanation: object.explanation
    })),
    sourceAnchors: scene.sourceAnchors,
    transitionToNext: scene.transitionToNext
  });
}

export async function getLongSceneDescription(scene: ScenePlan, fetchImpl: FetchLike = fetch): Promise<string> {
  const cacheKey = longSceneDescriptionCacheKey(scene);
  const cached = longDescriptionCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const script = await generateLongSceneDescription(scene, fetchImpl);
  longDescriptionCache.set(cacheKey, script);
  return script;
}

export function buildFallbackLongSceneDescription(scene: ScenePlan): string {
  const objectSentences = scene.objects.map((object) => (
    `${object.label} holds the player's attention: ${object.description} It matters because ${object.explanation}`
  ));
  const anchors = scene.sourceAnchors
    .slice(0, 2)
    .map((anchor) => `The source anchor, "${anchor.quote}", keeps this moment tied to ${anchor.meaning}`)
    .join(" ");

  return normalizeScript([
    `${scene.title} opens as ${scene.dressing}.`,
    scene.summary,
    `The mood is ${scene.mood}, and the space should feel physical enough to walk through rather than merely observe.`,
    ...objectSentences,
    anchors,
    `When the scene is ready to move on, ${scene.transitionToNext.description}`
  ].filter(Boolean).join(" "));
}

export function captionCuesFromAlignment(alignment: ElevenLabsAlignment | null, fallbackScript: string): CaptionCue[] {
  const characters = Array.isArray(alignment?.characters) ? alignment.characters : [];
  const starts = Array.isArray(alignment?.character_start_times_seconds)
    ? alignment.character_start_times_seconds
    : [];
  const ends = Array.isArray(alignment?.character_end_times_seconds)
    ? alignment.character_end_times_seconds
    : [];

  if (characters.length === 0 || starts.length !== characters.length || ends.length !== characters.length) {
    return estimateCaptionCues(fallbackScript);
  }

  const text = characters.map((character) => typeof character === "string" ? character : "").join("");
  const ranges = sentenceRanges(text);
  const cues = ranges.flatMap((range) => {
    const startIndex = firstTimedIndex(starts, range.start, range.end);
    const endIndex = lastTimedIndex(ends, range.start, range.end);

    if (startIndex === null || endIndex === null) {
      return [];
    }

    const start = numericValue(starts[startIndex]);
    const end = numericValue(ends[endIndex]);
    const cueText = text.slice(range.start, range.end).trim();

    if (start === null || end === null || !cueText || end <= start) {
      return [];
    }

    return [{ end, start, text: cueText }];
  });

  return cues.length > 0 ? cues : estimateCaptionCues(fallbackScript);
}

export function estimateCaptionCues(script: string): CaptionCue[] {
  const ranges = sentenceRanges(script);
  let cursor = 0;

  return ranges.map((range) => {
    const text = script.slice(range.start, range.end).trim();
    const wordCount = Math.max(1, text.split(/\s+/).filter(Boolean).length);
    const duration = Math.max(1.6, wordCount * 0.38);
    const cue = {
      end: Number((cursor + duration).toFixed(2)),
      start: Number(cursor.toFixed(2)),
      text
    };

    cursor += duration + 0.18;
    return cue;
  });
}

function withNarrationResult(scene: ScenePlan, result: SceneNarrationResult): ScenePlan {
  return withNarrationIntegration(scene, {
    audioUrl: result.audioUrl,
    captions: result.captions,
    modelId: result.modelId,
    script: result.script,
    voiceId: result.voiceId ?? undefined,
    warning: result.warning
  });
}

function withNarrationIntegration(
  scene: ScenePlan,
  narration: {
    audioUrl: string | null;
    captions?: CaptionCue[];
    modelId?: string;
    script: string;
    voiceId?: string | null;
    warning?: string;
  }
): ScenePlan {
  return {
    ...scene,
    integrations: {
      ...scene.integrations,
      narration: {
        provider: "elevenlabs",
        script: narration.script,
        audioUrl: narration.audioUrl,
        ...(narration.captions ? { captions: narration.captions } : {}),
        ...(narration.modelId ? { modelId: narration.modelId } : {}),
        ...(narration.voiceId ? { voiceId: narration.voiceId } : {}),
        ...(narration.warning ? { warning: narration.warning } : {})
      }
    }
  };
}

async function generateLongSceneDescription(scene: ScenePlan, fetchImpl: FetchLike): Promise<string> {
  const apiKey = process.env.BACKBOARD_API_KEY?.trim();

  if (!apiKey) {
    return buildFallbackLongSceneDescription(scene);
  }

  const response = await fetchImpl(BACKBOARD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({
      content: buildLongDescriptionPrompt(scene),
      system_prompt: "You write vivid but concise narration scripts for explorable 3D story scenes. Return strict JSON only.",
      llm_provider: "google",
      model_name: "gemini-3-flash-preview",
      memory: "off",
      web_search: "off",
      send_to_llm: "true",
      json_output: true,
      stream: false
    })
  });

  if (!response.ok) {
    return buildFallbackLongSceneDescription(scene);
  }

  try {
    const body = await response.json();
    const text = extractBackboardText(body);
    const json = extractJsonObject(text);
    const script = typeof (json as { script?: unknown }).script === "string"
      ? (json as { script: string }).script
      : "";

    return script.trim() ? normalizeScript(script) : buildFallbackLongSceneDescription(scene);
  } catch {
    return buildFallbackLongSceneDescription(scene);
  }
}

async function prepareDemoSceneNarration(scene: ScenePlan, fetchImpl: FetchLike): Promise<ScenePlan> {
  const manifest = await readDemoNarrationManifest();
  const scriptCacheKey = longSceneDescriptionCacheKey(scene);
  const narrationKey = sceneNarrationCacheKey(scene);
  const entry = manifest[scene.id];

  if (
    entry?.longDescriptionCacheKey === scriptCacheKey
    && entry.narrationCacheKey === narrationKey
    && (!entry.audioPath || await publicAssetExists(entry.audioPath))
  ) {
    return withNarrationIntegration(scene, {
      audioUrl: entry.audioPath,
      captions: entry.captions,
      modelId: entry.modelId,
      script: entry.script,
      voiceId: entry.voiceId,
      warning: entry.warning
    });
  }

  const result = await getCachedSceneNarration(scene, fetchImpl);
  const audioPath = result.audioUrl ? await writeDemoNarrationAudio(scene.id, narrationKey, result.audioUrl) : null;
  const persistedResult: SceneNarrationResult = {
    ...result,
    audioUrl: audioPath
  };

  manifest[scene.id] = {
    audioPath,
    cachedAt: new Date().toISOString(),
    captions: result.captions,
    longDescriptionCacheKey: scriptCacheKey,
    modelId: result.modelId,
    narrationCacheKey: narrationKey,
    script: result.script,
    voiceId: result.voiceId,
    ...(result.warning ? { warning: result.warning } : {})
  };
  await writeDemoNarrationManifest(manifest);

  return withNarrationResult(scene, persistedResult);
}

async function hydrateDemoSceneNarration(scene: ScenePlan): Promise<ScenePlan> {
  const manifest = await readDemoNarrationManifest();
  const entry = manifest[scene.id];
  const missingWarning = "Demo narration cache is missing; using captions without provider generation.";
  const missingAudioWarning = "Demo narration audio is missing; using captions without provider generation.";

  if (entry) {
    const audioExists = entry.audioPath ? await publicAssetExists(entry.audioPath) : false;

    if (audioExists) {
      return withNarrationIntegration(scene, {
        audioUrl: entry.audioPath,
        captions: entry.captions,
        modelId: entry.modelId,
        script: entry.script,
        voiceId: entry.voiceId,
        warning: entry.warning
      });
    }

    return withNarrationIntegration(scene, {
      audioUrl: null,
      captions: entry.captions.length > 0 ? entry.captions : estimateCaptionCues(entry.script),
      modelId: entry.modelId,
      script: entry.script,
      voiceId: entry.voiceId,
      warning: entry.warning ? `${entry.warning} ${missingAudioWarning}` : missingAudioWarning
    });
  }

  const script = selectSceneNarrationScript(scene);
  return withNarrationIntegration(scene, {
    audioUrl: null,
    captions: estimateCaptionCues(script),
    modelId: scene.integrations?.narration?.modelId ?? sceneNarrationProviderConfig().modelId,
    script,
    voiceId: scene.integrations?.narration?.voiceId,
    warning: missingWarning
  });
}

async function readDemoNarrationManifest(): Promise<DemoNarrationManifest> {
  try {
    const raw = await readFile(DEMO_NARRATION_MANIFEST, "utf8");
    const parsed = JSON.parse(raw) as DemoNarrationManifest;

    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function writeDemoNarrationManifest(manifest: DemoNarrationManifest) {
  await mkdir(DEMO_NARRATION_DIR, { recursive: true });
  await writeFile(DEMO_NARRATION_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeDemoNarrationAudio(sceneId: string, cacheKey: string, audioUrl: string): Promise<string | null> {
  const base64 = audioUrl.match(/^data:audio\/mpeg;base64,(.+)$/)?.[1];

  if (!base64) {
    return audioUrl.startsWith("/") ? audioUrl : null;
  }

  const fileName = `${safeFileSegment(sceneId)}-${stableHash(cacheKey).slice(0, 12)}.mp3`;
  const filePath = path.join(DEMO_NARRATION_DIR, fileName);
  await mkdir(DEMO_NARRATION_DIR, { recursive: true });
  await writeFile(filePath, Buffer.from(base64, "base64"));

  return `/demo/narration/${fileName}`;
}

async function publicAssetExists(publicPath: string): Promise<boolean> {
  try {
    await readFile(path.join(process.cwd(), "public", publicPath.replace(/^\//, "")));
    return true;
  } catch {
    return false;
  }
}

function buildLongDescriptionPrompt(scene: ScenePlan): string {
  return [
    "Write a longer spoken narration script for this scene.",
    "Return JSON only with this shape: {\"script\":\"...\"}.",
    "Target 120 to 170 words.",
    "Describe concrete spatial details, objects, mood, and the story beat.",
    "Do not mention templates, JSON, cameras, controls, apps, or users.",
    "Keep it suitable for ElevenLabs text-to-speech.",
    JSON.stringify({
      title: scene.title,
      summary: scene.summary,
      dressing: scene.dressing,
      mood: scene.mood,
      existingNarration: scene.narration,
      objects: scene.objects,
      sourceAnchors: scene.sourceAnchors,
      transitionToNext: scene.transitionToNext
    })
  ].join("\n\n");
}

function normalizeScript(script: string): string {
  return script.replace(/\s+/g, " ").trim();
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

function valueAt(value: unknown, pathName: string): unknown {
  return pathName.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, value);
}

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

function safeFileSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "scene";
}

function sentenceRanges(text: string): Array<{ end: number; start: number }> {
  const ranges: Array<{ end: number; start: number }> = [];
  const matcher = /[^.!?]+(?:[.!?]+["')\]]*)?\s*/g;

  for (const match of text.matchAll(matcher)) {
    const raw = match[0];
    const baseStart = match.index ?? 0;
    const leadingWhitespace = raw.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespace = raw.match(/\s*$/)?.[0].length ?? 0;
    const start = baseStart + leadingWhitespace;
    const end = baseStart + raw.length - trailingWhitespace;

    if (end > start) {
      ranges.push({ end, start });
    }
  }

  if (ranges.length === 0 && text.trim()) {
    const start = text.search(/\S/);
    ranges.push({ end: text.trimEnd().length, start: Math.max(0, start) });
  }

  return ranges;
}

function firstTimedIndex(values: unknown[], start: number, end: number): number | null {
  for (let index = start; index < end; index += 1) {
    if (numericValue(values[index]) !== null) {
      return index;
    }
  }

  return null;
}

function lastTimedIndex(values: unknown[], start: number, end: number): number | null {
  for (let index = end - 1; index >= start; index -= 1) {
    if (numericValue(values[index]) !== null) {
      return index;
    }
  }

  return null;
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
