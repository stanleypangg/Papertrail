"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SceneCards } from "@/components/SceneCards";
import { UploadPanel } from "@/components/UploadPanel";
import { demoScenes } from "@/lib/demoData";
import type { ScenePlan } from "@/lib/sceneSchema";

const WorldViewer = dynamic(() => import("@/components/WorldViewer").then((module) => module.WorldViewer), {
  ssr: false,
  loading: () => <LoadingState label="Opening the world" />
});

type AppMode = "upload" | "loading" | "cards" | "world" | "error";

type GenerateResponse = {
  scenes?: ScenePlan[];
  source?: string;
  warning?: string;
  warnings?: string[];
};

type GenerateImageResponse = {
  imageUrl?: string | null;
  warning?: string;
};

type SceneImageResult = readonly [string, string, string | null, string | null];
type SceneImageMap = Record<string, string | null>;

const IMAGE_PROMPT_VERSION = "panorama-v1";

async function generateImagesForScenes(scenes: ScenePlan[]) {
  const entries = await Promise.all(
    scenes.map(async (scene) => {
      try {
        const response = await fetch("/api/generate-scene-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: scene.stylePrompt })
        });
        const body = (await response.json()) as GenerateImageResponse;
        return [sceneImageKey(scene), scene.id, body.imageUrl ?? null, body.warning ?? null] as SceneImageResult;
      } catch {
        return [sceneImageKey(scene), scene.id, null, `Could not generate a preview image for ${scene.title}.`] as SceneImageResult;
      }
    })
  );

  const images = Object.fromEntries(entries.map(([key, , imageUrl]) => [key, imageUrl])) as SceneImageMap;
  const warnings = entries.flatMap(([, sceneId, imageUrl, warning]) => {
    if (imageUrl || !warning) {
      return [];
    }

    const scene = scenes.find((candidate) => candidate.id === sceneId);
    return [`${scene?.title ?? sceneId}: ${warning}`];
  });

  return { images, warnings };
}

function sceneImageKey(scene: ScenePlan) {
  return `${IMAGE_PROMPT_VERSION}:${scene.id}`;
}

function visibleSceneImages(scenes: ScenePlan[], images: SceneImageMap): SceneImageMap {
  return Object.fromEntries(scenes.map((scene) => [scene.id, images[sceneImageKey(scene)] ?? null])) as SceneImageMap;
}

export default function Home() {
  const [mode, setMode] = useState<AppMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [scenes, setScenes] = useState<ScenePlan[]>(demoScenes);
  const [sceneImages, setSceneImages] = useState<SceneImageMap>({});
  const [imageWarnings, setImageWarnings] = useState<string[]>([]);
  const [source, setSource] = useState("demo");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const visibleImages = visibleSceneImages(scenes, sceneImages);

  useEffect(() => {
    if (mode !== "cards" && mode !== "world") {
      return;
    }

    let active = true;
    const missingScenes = scenes.filter((scene) => !(sceneImageKey(scene) in sceneImages));

    if (missingScenes.length === 0) {
      return;
    }

    async function generateImages() {
      const { images, warnings } = await generateImagesForScenes(missingScenes);

      if (active) {
        setSceneImages((current) => ({ ...current, ...images }));
        setImageWarnings((current) => Array.from(new Set([...current, ...warnings])));
      }
    }

    generateImages();

    return () => {
      active = false;
    };
  }, [mode, sceneImages, scenes]);

  async function generateFromPdf() {
    if (!file) {
      return;
    }

    setMode("loading");
    setWarnings([]);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const parseResponse = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData
      });
      const parsed = (await parseResponse.json()) as {
        text?: string;
        warning?: string;
        error?: string;
      };

      if (!parseResponse.ok || !parsed.text) {
        throw new Error(parsed.error ?? "Could not extract text from the PDF.");
      }

      const sceneResponse = await fetch("/api/generate-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: parsed.text })
      });
      const generated = (await sceneResponse.json()) as GenerateResponse;

      if (!generated.scenes || generated.scenes.length === 0) {
        throw new Error("No scenes were returned.");
      }

      const imageResult = await generateImagesForScenes(generated.scenes);

      setScenes(generated.scenes);
      setSceneImages(imageResult.images);
      setImageWarnings(imageResult.warnings);
      setSource(generated.source ?? "unknown");
      setWarnings([
        ...(parsed.warning ? [parsed.warning] : []),
        ...(generated.warning ? [generated.warning] : []),
        ...(generated.warnings ?? [])
      ]);
      setMode("cards");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
      setMode("error");
    }
  }

  async function useDemoWorld() {
    setMode("loading");
    setWarnings([]);
    setError("");

    const imageResult = await generateImagesForScenes(demoScenes);

    setScenes(demoScenes);
    setSceneImages(imageResult.images);
    setImageWarnings(imageResult.warnings);
    setSource("demo");
    setWarnings(["Using hardcoded fallback scenes so the demo remains playable."]);
    setMode("cards");
  }

  function reset() {
    setFile(null);
    setSceneImages({});
    setImageWarnings([]);
    setWarnings([]);
    setError("");
    setMode("upload");
  }

  if (mode === "loading") {
    return <LoadingState label="Generating the world" />;
  }

  if (mode === "cards") {
    return (
      <SceneCards
        scenes={scenes}
        images={visibleImages}
        source={source}
        warnings={[...warnings, ...imageWarnings]}
        onEnterWorld={() => setMode("world")}
        onReset={reset}
      />
    );
  }

  if (mode === "world") {
    return <WorldViewer scenes={scenes} sceneImages={visibleImages} onExit={() => setMode("cards")} />;
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
