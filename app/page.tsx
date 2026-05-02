"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState, type LoadingProgressState } from "@/components/LoadingState";
import { SceneCards } from "@/components/SceneCards";
import { UploadPanel } from "@/components/UploadPanel";
import { demoScenes, demoSplatPreviewImages } from "@/lib/demoData";
import { DEMO_SPLAT_MANIFEST_URL, emptySceneColliderMap, emptySceneSplatMap, sceneCollidersFromManifest, sceneSplatsFromManifest, type DemoSplatManifest, type SceneColliderMap, type SceneSplatMap } from "@/lib/demoSplats";
import type { SceneObjectModelMap } from "@/lib/objectModels";
import { sceneImageKey, visibleSceneImages, type SceneImageMap } from "@/lib/sceneImages";
import type { ScenePlan } from "@/lib/sceneSchema";
import type { WorldGenerationEvent } from "@/lib/worldGenerationEvents";

const WorldViewer = dynamic(() => import("@/components/WorldViewer").then((module) => module.WorldViewer), {
  ssr: false,
  loading: () => <LoadingState label="Opening the world" />
});

type AppMode = "upload" | "loading" | "cards" | "world" | "error";

let nextProgressLogId = 0;

export default function Home() {
  const [mode, setMode] = useState<AppMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [scenes, setScenes] = useState<ScenePlan[]>(demoScenes);
  const [sceneImages, setSceneImages] = useState<SceneImageMap>(() => demoSceneImages());
  const [sceneColliders, setSceneColliders] = useState<SceneColliderMap>(() => emptySceneColliderMap(demoScenes));
  const [sceneSplats, setSceneSplats] = useState<SceneSplatMap>(() => emptySceneSplatMap(demoScenes));
  const [objectModels, setObjectModels] = useState<SceneObjectModelMap>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgressState>(() => createInitialProgress());
  const [error, setError] = useState("");
  const generationAbortRef = useRef<AbortController | null>(null);
  const visibleImages = visibleSceneImages(scenes, sceneImages);

  useEffect(() => {
    let canceled = false;

    fetch(DEMO_SPLAT_MANIFEST_URL, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<DemoSplatManifest> : null)
      .then((manifest) => {
        if (!canceled) {
          setSceneColliders(sceneCollidersFromManifest(scenes, manifest));
          setSceneSplats(sceneSplatsFromManifest(scenes, manifest));
        }
      })
      .catch(() => {
        if (!canceled) {
          setSceneColliders(emptySceneColliderMap(scenes));
          setSceneSplats(emptySceneSplatMap(scenes));
        }
      });

    return () => {
      canceled = true;
    };
  }, [scenes]);

  async function generateFromPdf() {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("mode", "pdf");
    formData.append("file", file);

    await generateWorldFromStream(formData, { openWorldOnComplete: false });
  }

  async function useDemoWorld() {
    const formData = new FormData();
    formData.append("mode", "demo");

    await generateWorldFromStream(formData, { openWorldOnComplete: true });
  }

  async function generateWorldFromStream(
    formData: FormData,
    options: { openWorldOnComplete?: boolean } = {}
  ) {
    generationAbortRef.current?.abort();

    const controller = new AbortController();
    generationAbortRef.current = controller;

    setMode("loading");
    setSceneImages({});
    setSceneColliders(emptySceneColliderMap(scenes));
    setSceneSplats(emptySceneSplatMap(scenes));
    setObjectModels({});
    setShareUrl(null);
    setWarnings([]);
    setError("");
    setLoadingProgress(createInitialProgress());

    try {
      const response = await fetch("/api/generate-world-stream", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      let completed = false;
      await readWorldGenerationStream(response, (event) => {
        if (event.type === "error") {
          throw new Error(event.message);
        }

        handleWorldGenerationEvent(event, options.openWorldOnComplete === true);
        completed = completed || event.type === "complete";
      });

      if (!completed) {
        throw new Error("World generation ended before the world was assembled.");
      }
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") {
        return;
      }

      setError(reason instanceof Error ? reason.message : "Something went wrong.");
      setMode("error");
    } finally {
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null;
      }
    }
  }

  function handleWorldGenerationEvent(event: WorldGenerationEvent, openWorldOnComplete = false) {
    if (event.type === "progress") {
      setLoadingProgress((current) => applyProgressEvent(current, event));
      return;
    }

    if (event.type === "image-complete") {
      setSceneImages((current) => ({ ...current, [event.imageKey]: event.imageUrl }));
      return;
    }

    if (event.type === "model-progress") {
      setLoadingProgress((current) => applyModelProgressEvent(current, event));
      return;
    }

    if (event.type === "model-complete") {
      setObjectModels((current) => ({
        ...current,
        [event.sceneId]: {
          ...(current[event.sceneId] ?? {}),
          [event.objectId]: event.model
        }
      }));
      return;
    }

    if (event.type === "complete") {
      const shareResult = createShareUrl(event.sharePath);
      setScenes(event.scenes);
      setSceneImages(event.sceneImages);
      setSceneColliders(sceneCollidersFromManifest(event.scenes, null));
      setSceneSplats(sceneSplatsFromManifest(event.scenes, null));
      setObjectModels(event.objectModels);
      setWarnings([...event.warnings, ...(shareResult.warning ? [shareResult.warning] : [])]);
      setShareUrl(shareResult.url);
      setJoinCode(event.joinCode);
      setMode(openWorldOnComplete ? "world" : "cards");
    }
  }

  function reset() {
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    setFile(null);
    setSceneImages(demoSceneImages());
    setSceneColliders(emptySceneColliderMap(demoScenes));
    setSceneSplats(emptySceneSplatMap(demoScenes));
    setObjectModels({});
    setShareUrl(null);
    setJoinCode(null);
    setWarnings([]);
    setError("");
    setLoadingProgress(createInitialProgress());
    setMode("upload");
  }

  if (mode === "loading") {
    return <LoadingState label="Generating the world" progress={loadingProgress} />;
  }

  if (mode === "cards") {
    return (
      <SceneCards
        scenes={scenes}
        images={visibleImages}
        warnings={warnings}
        shareUrl={shareUrl}
        joinCode={joinCode}
        onEnterWorld={() => setMode("world")}
        onReset={reset}
      />
    );
  }

  if (mode === "world") {
    return (
      <WorldViewer
        scenes={scenes}
        sceneImages={visibleImages}
        sceneColliders={sceneColliders}
        sceneSplats={sceneSplats}
        objectModels={objectModels}
        onExit={() => setMode("cards")}
      />
    );
  }

  if (mode === "error") {
    return <ErrorState message={error} onUseDemo={useDemoWorld} onReset={reset} />;
  }

  return (
    <UploadPanel
      file={file}
      onFileChange={setFile}
      onGenerate={generateFromPdf}
      onUseDemo={useDemoWorld}
      busy={false}
    />
  );
}

async function readWorldGenerationStream(
  response: Response,
  onEvent: (event: WorldGenerationEvent) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("World generation did not return a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const separatorIndex = buffer.indexOf("\n\n");
      if (separatorIndex === -1) {
        break;
      }

      const frame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const event = parseStreamFrame(frame);

      if (event) {
        onEvent(event);
      }
    }
  }

  const trailing = decoder.decode();
  if (trailing) {
    buffer += trailing;
  }

  if (buffer.trim()) {
    const event = parseStreamFrame(buffer);

    if (event) {
      onEvent(event);
    }
  }
}

function parseStreamFrame(frame: string): WorldGenerationEvent | null {
  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return JSON.parse(dataLines.join("\n")) as WorldGenerationEvent;
  } catch {
    return null;
  }
}

function demoSceneImages(): SceneImageMap {
  return Object.fromEntries(
    demoScenes.map((scene) => [sceneImageKey(scene), demoSplatPreviewImages[scene.id] ?? null])
  ) as SceneImageMap;
}

function createShareUrl(sharePath: string | null | undefined): { url: string | null; warning?: string } {
  if (!sharePath) {
    return { url: null };
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_SHARE_ORIGIN?.trim();
  const fallbackOrigin = window.location.origin;
  const originResult = configuredOrigin
    ? chooseShareOrigin(configuredOrigin, fallbackOrigin)
    : { origin: fallbackOrigin };

  return {
    url: new URL(sharePath, originResult.origin).toString(),
    warning: originResult.warning
  };
}

function chooseShareOrigin(configuredOrigin: string, currentOrigin: string): { origin: string; warning?: string } {
  const configuredResult = parseShareOrigin(configuredOrigin);

  if (configuredResult.warning) {
    return configuredResult;
  }

  const currentResult = parseShareOrigin(currentOrigin);

  if (currentResult.warning) {
    return configuredResult;
  }

  const configuredUrl = new URL(configuredResult.origin);
  const currentUrl = new URL(currentResult.origin);

  if (!isLocalHost(currentUrl.hostname) && currentUrl.origin !== configuredUrl.origin) {
    return {
      origin: currentUrl.origin,
      warning: `NEXT_PUBLIC_SHARE_ORIGIN points at ${configuredUrl.origin}, but this session is running at ${currentUrl.origin}; using the current proxy origin for the VR headset link.`
    };
  }

  return configuredResult;
}

function parseShareOrigin(value: string): { origin: string; warning?: string } {
  try {
    return { origin: new URL(value).origin };
  } catch {
    return {
      origin: window.location.origin,
      warning: `NEXT_PUBLIC_SHARE_ORIGIN is invalid; using ${window.location.origin} for the VR headset link.`
    };
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

function createInitialProgress(): LoadingProgressState {
  return {
    percent: 0,
    title: "Opening the workshop",
    detail: "Preparing the generation stream.",
    logs: [],
    objectProgress: {},
    steps: [
      { stage: "parsing", label: "Read PDF", status: "pending" },
      { stage: "planning", label: "Plan scenes", status: "pending" },
      { stage: "narration", label: "Narrate scenes", status: "pending" },
      { stage: "images", label: "Paint worlds", status: "pending" },
      { stage: "models", label: "Sculpt objects", status: "pending" },
      { stage: "saving", label: "Save link", status: "pending" }
    ]
  };
}

function applyProgressEvent(
  current: LoadingProgressState,
  event: Extract<WorldGenerationEvent, { type: "progress" }>
): LoadingProgressState {
  return {
    ...current,
    percent: Math.max(current.percent, event.percent),
    title: event.title,
    detail: event.detail ?? current.detail,
    logs: event.log ? [{ id: nextProgressLogId++, text: event.log }, ...current.logs].slice(0, 5) : current.logs,
    steps: current.steps.map((step) => {
      if (step.stage === event.stage) {
        return { ...step, status: event.status };
      }

      if (step.status === "pending" && event.percent >= stageCompletionFloor(step.stage)) {
        return { ...step, status: "complete" };
      }

      return step;
    })
  };
}

function applyModelProgressEvent(
  current: LoadingProgressState,
  event: Extract<WorldGenerationEvent, { type: "model-progress" }>
): LoadingProgressState {
  return {
    ...current,
    objectProgress: {
      ...current.objectProgress,
      [`${event.sceneId}:${event.objectId}`]: {
        label: event.label,
        progress: event.providerProgress,
        status: event.status
      }
    }
  };
}

function stageCompletionFloor(stage: LoadingProgressState["steps"][number]["stage"]): number {
  const floors: Record<LoadingProgressState["steps"][number]["stage"], number> = {
    parsing: 22,
    planning: 42,
    narration: 54,
    images: 68,
    models: 94,
    saving: 98
  };

  return floors[stage];
}
