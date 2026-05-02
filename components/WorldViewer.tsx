"use client";

import { Canvas } from "@react-three/fiber";
import { ArrowLeft, Bug, MousePointer2, RotateCcw, Settings } from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { BackSide } from "three";

import { ObjectInfoPanel } from "@/components/ObjectInfoPanel";
import { PlayerRig } from "@/components/three/PlayerRig";
import { SceneRenderer } from "@/components/three/SceneRenderer";
import { demoMuralUrl } from "@/lib/demoData";
import type { SceneObjectModelMap } from "@/lib/objectModels";
import type { WorldTarget } from "@/lib/sceneNavigation";
import type { SceneObject, ScenePlan } from "@/lib/sceneSchema";

type WorldViewerProps = {
  scenes: ScenePlan[];
  sceneImages: Record<string, string | null>;
  objectModels: SceneObjectModelMap;
  onExit: () => void;
  exitLabel?: string;
};

type MuralMode = "scene" | "cached" | "none";
type SceneImagePresentation = "mural" | "panorama";

export function WorldViewer({ scenes, sceneImages, objectModels, onExit, exitLabel = "Scene cards" }: WorldViewerProps) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedObject, setSelectedObject] = useState<SceneObject | null>(null);
  const [targetedTarget, setTargetedTarget] = useState<WorldTarget | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [muralMode, setMuralMode] = useState<MuralMode>("scene");
  const [resetSignal, setResetSignal] = useState(0);
  const lastSceneIndex = Math.max(scenes.length - 1, 0);
  const safeSceneIndex = Math.min(sceneIndex, lastSceneIndex);
  const scene = scenes[safeSceneIndex] ?? scenes[0];
  const sceneImageUrl = sceneImages[scene.id] ?? null;
  const effectiveSceneImageUrl =
    muralMode === "cached" ? demoMuralUrl : muralMode === "none" ? null : sceneImageUrl;
  const sceneImagePresentation: SceneImagePresentation = "panorama";
  const isLastScene = safeSceneIndex === scenes.length - 1;
  const instruction = pointerLocked
    ? "WASD to move. Aim at glowing objects or portals, then click or press E."
    : "Lock mouse look to walk the panorama. WASD moves between nearby objects.";

  const releasePointerLock = useCallback(() => {
    document.exitPointerLock?.();
    setPointerLocked(false);
  }, []);

  const exitToCards = useCallback(() => {
    releasePointerLock();
    onExit();
  }, [onExit, releasePointerLock]);

  const nextScene = useCallback(() => {
    setSelectedObject(null);
    setTargetedTarget(null);

    if (isLastScene) {
      exitToCards();
      return;
    }

    setSceneIndex((current) => Math.min(current + 1, scenes.length - 1));
  }, [exitToCards, isLastScene, scenes.length]);

  const jumpToScene = useCallback(
    (nextIndex: number) => {
      releasePointerLock();
      setSelectedObject(null);
      setTargetedTarget(null);
      setSceneIndex(Math.max(0, Math.min(nextIndex, lastSceneIndex)));
    },
    [lastSceneIndex, releasePointerLock]
  );

  const respawn = useCallback(() => {
    releasePointerLock();
    setSelectedObject(null);
    setTargetedTarget(null);
    setResetSignal((current) => current + 1);
  }, [releasePointerLock]);

  const selectObject = useCallback((object: SceneObject) => {
    releasePointerLock();
    setSelectedObject(object);
  }, [releasePointerLock]);

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

  return (
    <main className="canvas-crosshair relative h-svh w-screen overflow-hidden bg-black text-stone-50">
      <Canvas className="h-full w-full" style={{ width: "100vw", height: "100svh" }} shadows="basic">
        <Suspense fallback={<WorldCanvasFallback />}>
          <SceneRenderer
            scene={scene}
            sceneImageUrl={effectiveSceneImageUrl}
            sceneImagePresentation={sceneImagePresentation}
            objectModels={objectModels[scene.id] ?? {}}
            targetedTarget={targetedTarget}
            onSelectObject={selectObject}
            onPortalClick={nextScene}
          />
        </Suspense>
        <PlayerRig
          layoutType={scene.layoutType}
          sceneId={scene.id}
          resetSignal={resetSignal}
          pointerLockSelector="#world-pointer-lock"
          onPointerLockChange={setPointerLocked}
          onTargetChange={setTargetedTarget}
          onActivateTarget={activateTarget}
        />
      </Canvas>

      <div className="pointer-events-none fixed left-4 top-4 z-20 w-[min(560px,calc(100vw-2rem))]">
        <div className="border border-white/12 bg-[#070b10]/75 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                Scene {safeSceneIndex + 1} of {scenes.length}
              </p>
              <h1 className="mt-2 text-2xl font-semibold">{scene.title}</h1>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-300">{scene.narration}</p>
        </div>
      </div>

      {!debugOpen ? (
        <div className="pointer-events-none fixed bottom-4 left-4 z-20 w-[min(520px,calc(100vw-8rem))] border border-white/12 bg-[#070b10]/72 p-3 text-xs leading-5 text-stone-300 backdrop-blur">
          <span className="inline-flex items-center gap-2 text-cyan-100">
            <MousePointer2 size={14} />
            {instruction}
          </span>
        </div>
      ) : null}

      <div className="fixed right-4 top-4 z-30 flex flex-wrap justify-end gap-2">
        <button
          id="world-pointer-lock"
          type="button"
          className="inline-flex items-center gap-2 border border-white/14 bg-black/50 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60"
        >
          <MousePointer2 size={16} />
          {pointerLocked ? "Mouse locked" : "Lock mouse"}
        </button>
        <button
          type="button"
          onClick={exitToCards}
          className="inline-flex items-center gap-2 border border-white/14 bg-black/50 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60"
        >
          <ArrowLeft size={16} />
          {exitLabel}
        </button>
      </div>

      <div className="fixed bottom-4 right-4 z-30 w-[min(380px,calc(100vw-2rem))]">
        <div className="flex justify-end">
          <button
            type="button"
            aria-expanded={debugOpen}
            onClick={() => {
              releasePointerLock();
              setDebugOpen((current) => !current);
            }}
            className="inline-flex items-center gap-2 border border-white/14 bg-black/55 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60"
          >
            <Settings size={16} />
            Debug
          </button>
        </div>

        {debugOpen ? (
          <div className="mt-2 border border-cyan-200/20 bg-[#070b10]/88 p-4 text-sm text-stone-100 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-100/80">
                  <Bug size={13} />
                  Viewer debug
                </p>
                <p className="mt-2 text-stone-300">
                  {scene.layoutType} / {scene.mood} / {scene.objects.length} objects
                </p>
              </div>
              <button
                type="button"
                onClick={respawn}
                className="inline-flex min-h-10 items-center gap-2 border border-white/14 px-3 text-xs text-stone-100 transition hover:border-cyan-200/60"
              >
                <RotateCcw size={14} />
                Respawn
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Scene</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {scenes.map((candidate, index) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => jumpToScene(index)}
                    className={`min-h-10 border px-3 text-xs transition ${
                      index === safeSceneIndex
                        ? "border-cyan-200 bg-cyan-200 text-slate-950"
                        : "border-white/14 text-stone-200 hover:border-cyan-200/60"
                    }`}
                    title={candidate.title}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Panorama</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["scene", "Scene art"],
                    ["cached", "Cached"],
                    ["none", "None"]
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      releasePointerLock();
                      setMuralMode(mode);
                    }}
                    className={`min-h-10 border px-3 text-xs transition ${
                      mode === muralMode
                        ? "border-cyan-200 bg-cyan-200 text-slate-950"
                        : "border-white/14 text-stone-200 hover:border-cyan-200/60"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 truncate text-xs text-stone-400">
                {muralMode === "cached"
                  ? demoMuralUrl
                  : muralMode === "none"
                    ? "No panorama texture"
                    : sceneImageUrl || "No scene art available"}
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => jumpToScene(safeSceneIndex - 1)}
                disabled={safeSceneIndex === 0}
                className="min-h-10 flex-1 border border-white/14 px-3 text-xs text-stone-200 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => jumpToScene(safeSceneIndex + 1)}
                disabled={safeSceneIndex === scenes.length - 1}
                className="min-h-10 flex-1 border border-white/14 px-3 text-xs text-stone-200 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ObjectInfoPanel object={selectedObject} onClose={() => setSelectedObject(null)} />
    </main>
  );
}

function WorldCanvasFallback() {
  return (
    <>
      <color attach="background" args={["#101923"]} />
      <ambientLight intensity={0.95} color="#dff8ff" />
      <pointLight position={[0, 2.2, 0]} intensity={1.8} color="#79f2ff" distance={9} />
      <mesh>
        <sphereGeometry args={[70, 48, 24]} />
        <meshBasicMaterial color="#101923" side={BackSide} />
      </mesh>
      <mesh position={[0, 1.2, -3.4]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color="#7defff" emissive="#2db8d8" emissiveIntensity={0.45} roughness={0.6} />
      </mesh>
    </>
  );
}
