"use client";

import { Canvas } from "@react-three/fiber";
import { createXRStore, XR } from "@react-three/xr";
import { ArrowLeft, Glasses, MousePointer2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ObjectInfoPanel } from "@/components/ObjectInfoPanel";
import { PlayerRig } from "@/components/three/PlayerRig";
import { SceneRenderer } from "@/components/three/SceneRenderer";
import type { WorldTarget } from "@/lib/sceneNavigation";
import type { SceneObject, ScenePlan } from "@/lib/sceneSchema";

type WorldViewerProps = {
  scenes: ScenePlan[];
  sceneImages: Record<string, string | null>;
  onExit: () => void;
};

export function WorldViewer({ scenes, sceneImages, onExit }: WorldViewerProps) {
  const xrStore = useMemo(() => createXRStore({ emulate: false, offerSession: false }), []);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedObject, setSelectedObject] = useState<SceneObject | null>(null);
  const [targetedTarget, setTargetedTarget] = useState<WorldTarget | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const [xrError, setXrError] = useState("");
  const scene = scenes[sceneIndex] ?? scenes[0];
  const isLastScene = sceneIndex === scenes.length - 1;
  const instruction = pointerLocked
    ? "WASD to move. Aim at glowing objects or portals, then click or press E."
    : "Lock mouse look to walk the world. Use Enter VR when your browser supports it.";

  const exitToCards = useCallback(() => {
    document.exitPointerLock?.();
    onExit();
  }, [onExit]);

  useEffect(() => {
    let active = true;

    if (!navigator.xr) {
      return;
    }

    navigator.xr
      .isSessionSupported("immersive-vr")
      .then((supported) => {
        if (active) {
          setVrSupported(supported);
        }
      })
      .catch(() => {
        if (active) {
          setVrSupported(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const nextScene = useCallback(() => {
    setSelectedObject(null);
    setTargetedTarget(null);

    if (isLastScene) {
      exitToCards();
      return;
    }

    setSceneIndex((current) => Math.min(current + 1, scenes.length - 1));
  }, [exitToCards, isLastScene, scenes.length]);

  const selectObject = useCallback((object: SceneObject) => {
    document.exitPointerLock?.();
    setSelectedObject(object);
  }, []);

  const activateTarget = useCallback(
    (target: WorldTarget) => {
      if (target.type === "portal") {
        nextScene();
        return;
      }

      const object = scene.objects.find((candidate) => candidate.id === target.id);
      if (object) {
        selectObject(object);
      }
    },
    [nextScene, scene.objects, selectObject]
  );

  async function enterVR() {
    setXrError("");

    try {
      await xrStore.enterVR();
    } catch (reason) {
      setXrError(reason instanceof Error ? reason.message : "Could not enter VR.");
    }
  }

  return (
    <main className="canvas-crosshair relative h-svh w-screen overflow-hidden bg-black text-stone-50">
      <Canvas className="h-full w-full" style={{ width: "100vw", height: "100svh" }} shadows="basic">
        <XR store={xrStore}>
          <SceneRenderer
            scene={scene}
            sceneImageUrl={sceneImages[scene.id] ?? null}
            targetedTarget={targetedTarget}
            onSelectObject={selectObject}
            onPortalClick={nextScene}
          />
          <PlayerRig
            layoutType={scene.layoutType}
            sceneId={scene.id}
            pointerLockSelector="#world-pointer-lock"
            onPointerLockChange={setPointerLocked}
            onTargetChange={setTargetedTarget}
            onActivateTarget={activateTarget}
          />
        </XR>
      </Canvas>

      <div className="pointer-events-none fixed left-4 top-4 z-20 w-[min(560px,calc(100vw-2rem))]">
        <div className="border border-white/12 bg-[#070b10]/75 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                Scene {sceneIndex + 1} of {scenes.length}
              </p>
              <h1 className="mt-2 text-2xl font-semibold">{scene.title}</h1>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-300">{scene.narration}</p>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-4 left-4 z-20 max-w-lg border border-white/12 bg-[#070b10]/72 p-3 text-xs leading-5 text-stone-300 backdrop-blur">
        <span className="inline-flex items-center gap-2 text-cyan-100">
          <MousePointer2 size={14} />
          {instruction}
        </span>
        {xrError ? <p className="mt-2 text-rose-200">{xrError}</p> : null}
      </div>

      <div className="fixed right-4 top-4 z-30 flex flex-wrap justify-end gap-2">
        <button
          id="world-pointer-lock"
          type="button"
          className="inline-flex items-center gap-2 border border-white/14 bg-black/50 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60"
        >
          <MousePointer2 size={16} />
          {pointerLocked ? "Mouse locked" : "Lock mouse"}
        </button>
        {vrSupported ? (
          <button
            type="button"
            onClick={enterVR}
            className="inline-flex items-center gap-2 border border-cyan-200/40 bg-cyan-300/12 px-4 py-2 text-sm text-cyan-50 backdrop-blur transition hover:border-cyan-100"
          >
            <Glasses size={16} />
            Enter VR
          </button>
        ) : null}
        <button
          type="button"
          onClick={exitToCards}
          className="inline-flex items-center gap-2 border border-white/14 bg-black/50 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60"
        >
          <ArrowLeft size={16} />
          Scene cards
        </button>
      </div>

      <ObjectInfoPanel object={selectedObject} onClose={() => setSelectedObject(null)} />
    </main>
  );
}
