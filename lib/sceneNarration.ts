import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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
const NARRATION_DIR = path.join(process.cwd(), "public", "narration", "demo");

type CachedNarration = SceneNarrationResult & {
  audioPath: string;
  cachedAt: string;
};

export function selectSceneNarrationScript(scene: ScenePlan): string {
  return scene.integrations?.narration?.script?.trim() || scene.narration.trim();
}

export async function generateSceneNarration(
  scene: ScenePlan,
  options: FetchLike | { force?: boolean; fetchImpl?: FetchLike } = {}
): Promise<SceneNarrationResult> {
  const fetchImpl = typeof options === "function" ? options : options.fetchImpl ?? fetch;
  const force = typeof options === "function" ? false : options.force === true;
  const shouldCacheAudio = typeof options !== "function";
  const script = selectSceneNarrationScript(scene);
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || null;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || ELEVENLABS_MODEL_ID;
  const baseResult = {
    modelId,
    sceneId: scene.id,
    script,
    voiceId
  };
  const cached = force || typeof options === "function" ? null : await readCachedNarration(scene.id);

  if (cached && cached.script === script && cached.modelId === modelId && cached.voiceId === voiceId) {
    return {
      ...cached,
      audioUrl: cached.audioPath
    };
  }

  if (!process.env.ELEVENLABS_API_KEY?.trim() || !voiceId) {
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
          "xi-api-key": process.env.ELEVENLABS_API_KEY
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
      audioUrl: shouldCacheAudio
        ? await cacheNarrationAudio(scene.id, audioBase64, {
          ...baseResult,
          captions
        })
        : `data:audio/mpeg;base64,${audioBase64}`,
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

async function readCachedNarration(sceneId: string): Promise<CachedNarration | null> {
  try {
    const file = await readFile(path.join(NARRATION_DIR, `${safeFilePart(sceneId)}.json`), "utf8");
    const parsed = JSON.parse(file) as Partial<CachedNarration>;

    if (
      typeof parsed.audioPath === "string"
      && typeof parsed.cachedAt === "string"
      && Array.isArray(parsed.captions)
      && typeof parsed.modelId === "string"
      && typeof parsed.sceneId === "string"
      && typeof parsed.script === "string"
    ) {
      return {
        audioPath: parsed.audioPath,
        audioUrl: parsed.audioPath,
        cachedAt: parsed.cachedAt,
        captions: parsed.captions,
        modelId: parsed.modelId,
        sceneId: parsed.sceneId,
        script: parsed.script,
        voiceId: typeof parsed.voiceId === "string" ? parsed.voiceId : null,
        warning: typeof parsed.warning === "string" ? parsed.warning : undefined
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function cacheNarrationAudio(
  sceneId: string,
  audioBase64: string,
  metadata: Omit<SceneNarrationResult, "audioUrl">
) {
  const safeSceneId = safeFilePart(sceneId);
  const audioFileName = `${safeSceneId}.mp3`;
  const audioPath = `/narration/demo/${audioFileName}`;
  const cachedAt = new Date().toISOString();

  await mkdir(NARRATION_DIR, { recursive: true });
  await writeFile(path.join(NARRATION_DIR, audioFileName), Buffer.from(audioBase64, "base64"));
  await writeFile(
    path.join(NARRATION_DIR, `${safeSceneId}.json`),
    `${JSON.stringify({ ...metadata, audioPath, audioUrl: audioPath, cachedAt }, null, 2)}\n`
  );

  return audioPath;
}

function safeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "scene";
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
