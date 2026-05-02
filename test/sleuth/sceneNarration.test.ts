import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captionCuesFromAlignment,
  buildFallbackLongSceneDescription,
  estimateCaptionCues,
  generateSceneNarration,
  getLongSceneDescription,
  hydrateDemoSceneNarrations,
  prepareSceneNarrations,
  sceneNarrationCacheKey,
  selectSceneNarrationScript
} from "@/lib/sceneNarration";
import { demoScenes } from "@/lib/demoData";
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
  vi.unstubAllGlobals();
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

  it("builds a stable cache key from script and provider config", () => {
    process.env = {
      ...originalEnv,
      ELEVENLABS_API_KEY: "first-key",
      ELEVENLABS_VOICE_ID: "voice-123",
      ELEVENLABS_MODEL_ID: "model-one"
    };

    const firstKey = sceneNarrationCacheKey(baseScene);

    process.env = {
      ...process.env,
      ELEVENLABS_API_KEY: "second-key"
    };

    expect(sceneNarrationCacheKey(baseScene)).toBe(firstKey);

    process.env = {
      ...process.env,
      ELEVENLABS_VOICE_ID: "voice-456"
    };

    expect(sceneNarrationCacheKey(baseScene)).not.toBe(firstKey);

    process.env = {
      ...process.env,
      ELEVENLABS_VOICE_ID: "voice-123",
      ELEVENLABS_MODEL_ID: "model-two"
    };

    expect(sceneNarrationCacheKey(baseScene)).not.toBe(firstKey);

    process.env = {
      ...process.env,
      ELEVENLABS_MODEL_ID: "model-one"
    };

    expect(sceneNarrationCacheKey({
      ...baseScene,
      integrations: {
        narration: {
          provider: "elevenlabs",
          script: "A different narration script.",
          audioUrl: null
        }
      }
    })).not.toBe(firstKey);
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

  it("builds deterministic fallback long descriptions", () => {
    const script = buildFallbackLongSceneDescription(baseScene);

    expect(script).toContain("Scene One opens as a compact gallery.");
    expect(script).toContain("Object One holds the player's attention");
    expect(script).toContain("A threshold.");
  });

  it("uses Backboard long descriptions when available", async () => {
    process.env = {
      ...originalEnv,
      BACKBOARD_API_KEY: "backboard-key"
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      content: JSON.stringify({ script: "A longer generated scene script with concrete details." })
    }), { status: 200 }));

    await expect(getLongSceneDescription({
      ...baseScene,
      id: "long-description-scene"
    }, fetchMock as unknown as typeof fetch)).resolves.toBe("A longer generated scene script with concrete details.");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.backboard.io/api/threads/messages",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": "backboard-key" }),
        method: "POST"
      })
    );
  });

  it("prepares narration only for scenes after the first", async () => {
    process.env = {
      ...originalEnv,
      BACKBOARD_API_KEY: "",
      ELEVENLABS_API_KEY: "test-key",
      ELEVENLABS_VOICE_ID: "voice-123",
      ELEVENLABS_MODEL_ID: "eleven_multilingual_v2"
    };
    const secondScene = {
      ...baseScene,
      id: "scene-two",
      title: "Scene Two"
    };
    const fetchMock = vi.fn(async () => {
      const text = buildFallbackLongSceneDescription(secondScene);
      const characters = [...text];

      return new Response(JSON.stringify({
        audio_base64: "prepared-audio",
        normalized_alignment: {
          characters,
          character_start_times_seconds: characters.map((_, index) => index * 0.05),
          character_end_times_seconds: characters.map((_, index) => (index + 1) * 0.05)
        }
      }), { status: 200 });
    });

    const result = await prepareSceneNarrations(
      [baseScene, secondScene],
      { fetchImpl: fetchMock as unknown as typeof fetch }
    );

    expect(result.scenes[0]?.integrations?.narration).toBeUndefined();
    expect(result.scenes[1]?.integrations?.narration?.audioUrl).toBe("data:audio/mpeg;base64,prepared-audio");
    expect(result.scenes[1]?.integrations?.narration?.captions?.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("hydrates every demo scene from committed narration assets without provider fetches", async () => {
    const fetchMock = vi.fn(() => {
      throw new Error("Demo narration must stay offline.");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await prepareSceneNarrations(demoScenes, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      mode: "demo-readonly"
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
    expect(result.scenes).toHaveLength(demoScenes.length);

    for (const scene of result.scenes) {
      expect(scene.integrations?.narration?.audioUrl).toMatch(/^\/demo\/narration\/.+\.mp3$/);
      expect(scene.integrations?.narration?.captions?.length).toBeGreaterThan(0);
      expect(scene.integrations?.narration?.script).toBeTruthy();
    }
  });

  it("uses caption fallback for missing demo cache entries without provider fetches", async () => {
    const fetchMock = vi.fn(() => {
      throw new Error("Demo narration must stay offline.");
    });
    vi.stubGlobal("fetch", fetchMock);

    const uncachedScene = {
      ...baseScene,
      id: "uncached-demo-scene",
      title: "Uncached Demo Scene"
    };

    const result = await hydrateDemoSceneNarrations([uncachedScene]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.warnings[0]).toContain("Demo narration cache is missing");
    expect(result.scenes[0]?.integrations?.narration).toMatchObject({
      audioUrl: null,
      script: baseScene.narration,
      warning: "Demo narration cache is missing; using captions without provider generation."
    });
    expect(result.scenes[0]?.integrations?.narration?.captions).toEqual(estimateCaptionCues(baseScene.narration));
  });

  it("reuses in-flight and completed route narration responses", async () => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      ELEVENLABS_API_KEY: "test-key",
      ELEVENLABS_VOICE_ID: "voice-123",
      ELEVENLABS_MODEL_ID: "eleven_multilingual_v2"
    };

    let resolveProviderResponse: (response: Response) => void = () => {};
    const providerResponse = new Promise<Response>((resolve) => {
      resolveProviderResponse = resolve;
    });
    const fetchMock = vi.fn(() => providerResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/generate-scene-narration/route");
    const scene = {
      ...baseScene,
      id: "route-cache-scene"
    };
    const requestForScene = () => new Request("http://localhost/api/generate-scene-narration", {
      method: "POST",
      body: JSON.stringify({ scene })
    });

    const firstResponsePromise = POST(requestForScene());
    await Promise.resolve();
    const pendingResponsePromise = POST(requestForScene());

    resolveProviderResponse(new Response(JSON.stringify({
      audio_base64: "cached-audio",
      normalized_alignment: {
        characters: [...scene.narration],
        character_start_times_seconds: [...scene.narration].map((_, index) => index * 0.1),
        character_end_times_seconds: [...scene.narration].map((_, index) => (index + 1) * 0.1)
      }
    }), { status: 200 }));

    const firstResponse = await firstResponsePromise;
    const pendingResponse = await pendingResponsePromise;
    const cachedResponse = await POST(requestForScene());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstResponse.headers.get("x-pageworld-narration-cache")).toBe("miss");
    expect(pendingResponse.headers.get("x-pageworld-narration-cache")).toBe("pending");
    expect(cachedResponse.headers.get("x-pageworld-narration-cache")).toBe("hit");
    await expect(cachedResponse.json()).resolves.toMatchObject({
      audioUrl: "data:audio/mpeg;base64,cached-audio",
      sceneId: "route-cache-scene"
    });
  });
});
