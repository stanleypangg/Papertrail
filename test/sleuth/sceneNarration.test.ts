import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captionCuesFromAlignment,
  estimateCaptionCues,
  generateSceneNarration,
  selectSceneNarrationScript
} from "@/lib/sceneNarration";
import type { ScenePlan } from "@/lib/sceneSchema";

const baseScene: ScenePlan = {
  id: "scene-one",
  title: "Scene One",
  summary: "A generated scene.",
  layoutType: "exhibit_space",
  dressing: "a compact gallery",
  mood: "neutral",
  stylePrompt: "cinematic gallery",
  narration: "Fallback narration. Second fallback line.",
  sourceAnchors: [],
  objects: [
    {
      id: "object-one",
      label: "Object One",
      visualType: "artifact",
      description: "A prop.",
      quote: "A quote.",
      explanation: "An explanation.",
      slot: "center"
    }
  ],
  transitionToNext: {
    label: "Next",
    description: "A threshold."
  }
};

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe("scene narration", () => {
  it("selects integration script before scene narration", () => {
    expect(selectSceneNarrationScript({
      ...baseScene,
      integrations: {
        narration: {
          provider: "elevenlabs",
          script: "Integrated script.",
          audioUrl: null
        }
      }
    })).toBe("Integrated script.");
  });

  it("builds sentence cues from character alignment", () => {
    const text = "First sentence. Second sentence!";
    const characters = [...text];
    const starts = characters.map((_, index) => index * 0.05);
    const ends = characters.map((_, index) => (index + 1) * 0.05);

    expect(captionCuesFromAlignment({
      characters,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends
    }, text)).toEqual([
      { start: 0, end: 0.75, text: "First sentence." },
      { start: 0.8, end: 1.6, text: "Second sentence!" }
    ]);
  });

  it("estimates fallback sentence cues when provider config is missing", async () => {
    process.env = {
      ...originalEnv,
      ELEVENLABS_API_KEY: "",
      ELEVENLABS_VOICE_ID: ""
    };
    const fetchMock = vi.fn();

    const result = await generateSceneNarration(baseScene, fetchMock as unknown as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.audioUrl).toBeNull();
    expect(result.warning).toContain("ELEVENLABS_API_KEY");
    expect(result.captions).toEqual(estimateCaptionCues(baseScene.narration));
  });

  it("posts to ElevenLabs and returns audio with normalized captions", async () => {
    process.env = {
      ...originalEnv,
      ELEVENLABS_API_KEY: "test-key",
      ELEVENLABS_VOICE_ID: "voice-123",
      ELEVENLABS_MODEL_ID: "eleven_multilingual_v2"
    };
    const text = baseScene.narration;
    const characters = [...text];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      audio_base64: "abc123",
      normalized_alignment: {
        characters,
        character_start_times_seconds: characters.map((_, index) => index * 0.1),
        character_end_times_seconds: characters.map((_, index) => (index + 1) * 0.1)
      }
    }), { status: 200 }));

    const result = await generateSceneNarration(baseScene, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-123/with-timestamps?output_format=mp3_44100_128",
      expect.objectContaining({
        headers: expect.objectContaining({ "xi-api-key": "test-key" }),
        method: "POST"
      })
    );
    expect(result.audioUrl).toBe("data:audio/mpeg;base64,abc123");
    expect(result.captions[0]?.text).toBe("Fallback narration.");
  });
});
