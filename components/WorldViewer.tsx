"use client";

import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ArrowLeft, MousePointer2, RotateCcw, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BoxHelper,
  Clock,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer
} from "three";

import type { SceneObjectModelMap } from "@/lib/objectModels";
import type { ScenePlan } from "@/lib/sceneSchema";

type WorldViewerProps = {
  scenes: ScenePlan[];
  sceneImages: Record<string, string | null>;
  sceneColliders?: Record<string, string | null>;
  sceneSplats?: Record<string, string | null>;
  objectModels: SceneObjectModelMap;
  onExit: () => void;
  exitLabel?: string;
};

type SplatTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

const DEFAULT_SPLAT_TRANSFORM: SplatTransform = {
  position: [0, 0, 0],
  rotation: [-180, 0, 0],
  scale: 1
};

const DEFAULT_COLLIDER_TRANSFORM: SplatTransform = {
  position: [0, 0, 0],
  rotation: [180, 0, 0],
  scale: 1
};

const PLAYER_HEIGHT = 1;
const START_Z = 2.5;
const WALK_SPEED = 1.2;
const SPRINT_MULTIPLIER = 2.4;
const COLLISION_RADIUS = 0.36;
const COLLISION_HEIGHTS = [0.24, 0.74];
const COLLISION_SIDE_OFFSETS = [-0.24, 0, 0.24];
const GRAVITY = -9.8;
const GROUND_PROBE_HEIGHT = 3;
const GROUND_PROBE_DEPTH = 8;
const GROUND_SNAP_DISTANCE = 0.22;
const MAX_STEP_HEIGHT = 0.22;
const LOOK_SENSITIVITY = 0.0022;
const tempForward = new Vector3();
const tempRight = new Vector3();
const tempMove = new Vector3();
const tempAxisMove = new Vector3();
const tempMoveDirection = new Vector3();
const tempMovePerp = new Vector3();
const tempRayOrigin = new Vector3();
const tempSize = new Vector3();
const tempNormal = new Vector3();
const movementRaycaster = new Raycaster();
const groundRaycaster = new Raycaster();
const COLLIDER_DEBUG_MATERIAL = new MeshBasicMaterial({
  color: 0x34d399,
  depthTest: false,
  depthWrite: false,
  side: DoubleSide,
  transparent: true,
  opacity: 0.62
});

export function WorldViewer({
  scenes,
  sceneColliders = {},
  sceneSplats = {},
  onExit,
  exitLabel = "Scene cards"
}: WorldViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sparkRendererRef = useRef<SparkRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const colliderBoundsRef = useRef<BoxHelper | null>(null);
  const colliderRef = useRef<Group | null>(null);
  const colliderObjectsRef = useRef<Object3D[]>([]);
  const colliderVisibleRef = useRef(false);
  const sceneRef = useRef<Scene | null>(null);
  const splatRef = useRef<SplatMesh | null>(null);
  const keysRef = useRef(new Set<string>());
  const verticalVelocityRef = useRef(0);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [colliderVisible, setColliderVisible] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [loadResult, setLoadResult] = useState<{ url: string; message: string } | null>(null);
  const [transforms, setTransforms] = useState<Record<string, SplatTransform>>({});
  const sceneIndex = selectedSceneIndex ?? firstSplatSceneIndex(scenes, sceneSplats);
  const safeSceneIndex = Math.max(0, Math.min(sceneIndex, scenes.length - 1));
  const scene = scenes[safeSceneIndex] ?? scenes[0];
  const sceneId = scene?.id;
  const colliderUrl = scene ? sceneColliders[scene.id] ?? null : null;
  const splatUrl = scene ? sceneSplats[scene.id] ?? null : null;
  const transform = scene ? transforms[scene.id] ?? DEFAULT_SPLAT_TRANSFORM : DEFAULT_SPLAT_TRANSFORM;
  const loadStatus = !splatUrl
    ? "No cached splat for this scene. Generate and cache it from /worldlabs."
    : loadResult?.url === splatUrl
      ? loadResult.message
      : `Loading ${splatUrl}`;

  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    keysRef.current.clear();
    verticalVelocityRef.current = 0;
    camera.rotation.set(0, 0, 0);
    camera.position.set(0, PLAYER_HEIGHT, START_Z);
    const look = cameraLookAtOrigin(camera);
    yawRef.current = look.yaw;
    pitchRef.current = look.pitch;
    camera.rotation.set(look.pitch, look.yaw, 0, "YXZ");
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }
    const mountElement = mount;

    const renderer = new WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mountElement.clientWidth, mountElement.clientHeight);
    renderer.setClearColor(new Color("#05070b"), 1);
    mountElement.append(renderer.domElement);

    const threeScene = new Scene();
    threeScene.background = new Color("#05070b");

    const camera = new PerspectiveCamera(70, mountElement.clientWidth / mountElement.clientHeight, 0.05, 1000);
    camera.position.set(0, PLAYER_HEIGHT, START_Z);

    const sparkRenderer = new SparkRenderer({
      renderer,
      enableLod: false,
      onDirty: () => renderer.render(threeScene, camera)
    });
    threeScene.add(sparkRenderer);

    rendererRef.current = renderer;
    sparkRendererRef.current = sparkRenderer;
    cameraRef.current = camera;
    sceneRef.current = threeScene;

    const clock = new Clock();

    function animate() {
      const delta = Math.min(clock.getDelta(), 0.05);
      updateMovement(camera, keysRef.current, yawRef.current, delta, colliderObjectsRef.current);
      verticalVelocityRef.current = updateVerticalPhysics(camera, delta, colliderObjectsRef.current, verticalVelocityRef.current);
      camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
      sparkRenderer.render(threeScene, camera);
    }

    renderer.setAnimationLoop(animate);

    function resize() {
      const width = mountElement.clientWidth;
      const height = mountElement.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      renderer.setAnimationLoop(null);
      splatRef.current?.dispose();
      splatRef.current = null;
      if (colliderBoundsRef.current) {
        threeScene.remove(colliderBoundsRef.current);
      }
      colliderBoundsRef.current = null;
      if (colliderRef.current) {
        threeScene.remove(colliderRef.current);
      }
      colliderRef.current = null;
      colliderObjectsRef.current = [];
      sparkRenderer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sparkRendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }

    const onPointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === renderer.domElement);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) {
        return;
      }

      yawRef.current -= event.movementX * LOOK_SENSITIVITY;
      pitchRef.current = clamp(
        pitchRef.current - event.movementY * LOOK_SENSITIVITY,
        -Math.PI / 2 + 0.02,
        Math.PI / 2 - 0.02
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };

    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const threeScene = sceneRef.current;
    if (!threeScene) {
      return;
    }

    splatRef.current?.dispose();
    if (splatRef.current) {
      threeScene.remove(splatRef.current);
      splatRef.current = null;
    }

    resetCamera();

    if (!splatUrl) {
      return;
    }

    let active = true;
    const splat = new SplatMesh({
      url: splatUrl,
      raycastable: false,
      onLoad: (mesh) => {
        if (!active) {
          return;
        }

        const box = mesh.getBoundingBox(true);
        const size = box.getSize(tempSize);
        const initialTransform = DEFAULT_SPLAT_TRANSFORM;
        applySplatTransform(mesh, initialTransform);
        if (cameraRef.current) {
          verticalVelocityRef.current = 0;
          cameraRef.current.position.set(0, PLAYER_HEIGHT, START_Z);
          const look = cameraLookAtOrigin(cameraRef.current);
          yawRef.current = look.yaw;
          pitchRef.current = look.pitch;
          cameraRef.current.rotation.set(look.pitch, look.yaw, 0, "YXZ");
        }
        if (sceneId) {
          setTransforms((current) => ({
            ...current,
            [sceneId]: current[sceneId] ?? initialTransform
          }));
        }
        setLoadResult({
          url: splatUrl,
          message: `Loaded ${splatUrl} (${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}), camera aimed at 0, 0, 0`
        });
      }
    });

    splat.frustumCulled = false;
    splat.visible = true;
    threeScene.add(splat);
    splatRef.current = splat;

    splat.initialized.catch((error: unknown) => {
      if (active) {
        setLoadResult({
          url: splatUrl,
          message: error instanceof Error ? error.message : "Could not load splat."
        });
      }
    });

    return () => {
      active = false;
      threeScene.remove(splat);
      splat.dispose();
      if (splatRef.current === splat) {
        splatRef.current = null;
      }
    };
  }, [resetCamera, sceneId, splatUrl]);

  useEffect(() => {
    if (splatRef.current) {
      applySplatTransform(splatRef.current, transform);
      splatRef.current.visible = true;
    }
  }, [transform]);

  useEffect(() => {
    colliderVisibleRef.current = colliderVisible;
    if (colliderRef.current) {
      applySplatTransform(colliderRef.current, DEFAULT_COLLIDER_TRANSFORM);
      colliderRef.current.updateMatrixWorld(true);
      colliderRef.current.visible = colliderVisible;
    }
    if (colliderBoundsRef.current) {
      colliderBoundsRef.current.update();
      colliderBoundsRef.current.visible = colliderVisible;
    }
  }, [colliderVisible]);

  useEffect(() => {
    const threeScene = sceneRef.current;
    if (!threeScene) {
      return;
    }

    if (colliderRef.current) {
      threeScene.remove(colliderRef.current);
      colliderRef.current = null;
      colliderObjectsRef.current = [];
    }
    if (colliderBoundsRef.current) {
      threeScene.remove(colliderBoundsRef.current);
      colliderBoundsRef.current.geometry.dispose();
      colliderBoundsRef.current = null;
    }

    if (!colliderUrl) {
      return;
    }

    let active = true;
    const loader = new GLTFLoader();

    loader.load(
      colliderUrl,
      (gltf) => {
        if (!active) {
          return;
        }

        const collider = gltf.scene;
        applySplatTransform(collider, DEFAULT_COLLIDER_TRANSFORM);
        collider.visible = false;
        const meshes: Object3D[] = [];
        collider.traverse((object) => {
          if (object instanceof Mesh) {
            object.frustumCulled = false;
            object.material = COLLIDER_DEBUG_MATERIAL;
            object.renderOrder = 999;
            meshes.push(object);
          }
        });
        threeScene.add(collider);
        collider.visible = colliderVisibleRef.current;
        collider.updateMatrixWorld(true);

        const bounds = new BoxHelper(collider, 0x34d399);
        bounds.visible = colliderVisibleRef.current;
        bounds.renderOrder = 1000;
        threeScene.add(bounds);
        bounds.update();

        colliderRef.current = collider;
        colliderBoundsRef.current = bounds;
        colliderObjectsRef.current = meshes;
      },
      undefined,
      () => {
        if (active) {
          colliderObjectsRef.current = [];
        }
      }
    );

    return () => {
      active = false;
      if (colliderBoundsRef.current) {
        threeScene.remove(colliderBoundsRef.current);
        colliderBoundsRef.current.geometry.dispose();
        colliderBoundsRef.current = null;
      }
      if (colliderRef.current) {
        threeScene.remove(colliderRef.current);
        colliderRef.current = null;
        colliderObjectsRef.current = [];
      }
    };
  }, [colliderUrl]);

  const lockPointer = useCallback(() => {
    rendererRef.current?.domElement.requestPointerLock();
  }, []);

  const exit = useCallback(() => {
    document.exitPointerLock?.();
    onExit();
  }, [onExit]);

  const updateTransform = useCallback((patch: Partial<SplatTransform>) => {
    if (!scene) {
      return;
    }

    setTransforms((current) => ({
      ...current,
      [scene.id]: {
        ...(current[scene.id] ?? DEFAULT_SPLAT_TRANSFORM),
        ...patch
      }
    }));
  }, [scene]);

  const resetSplatTransform = useCallback(() => {
    if (!scene || !splatRef.current) {
      return;
    }

    applySplatTransform(splatRef.current, DEFAULT_SPLAT_TRANSFORM);
    if (cameraRef.current) {
      verticalVelocityRef.current = 0;
      cameraRef.current.position.set(0, PLAYER_HEIGHT, START_Z);
      const look = cameraLookAtOrigin(cameraRef.current);
      yawRef.current = look.yaw;
      pitchRef.current = look.pitch;
      cameraRef.current.rotation.set(look.pitch, look.yaw, 0, "YXZ");
    }
    setTransforms((current) => ({
      ...current,
      [scene.id]: DEFAULT_SPLAT_TRANSFORM
    }));
  }, [scene]);

  return (
    <main className="relative h-svh w-screen overflow-hidden bg-black text-stone-50">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none fixed left-4 top-4 z-20 w-[min(560px,calc(100vw-2rem))]">
        <div className="border border-white/12 bg-[#070b10]/75 p-4 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            Scene {safeSceneIndex + 1} of {scenes.length}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{scene?.title ?? "Splat world"}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-300">{scene?.narration ?? loadStatus}</p>
        </div>
      </div>

      <div className="fixed right-4 top-4 z-30 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={lockPointer}
          className="inline-flex items-center gap-2 border border-white/14 bg-black/50 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60"
        >
          <MousePointer2 size={16} />
          {pointerLocked ? "Mouse locked" : "Lock mouse"}
        </button>
        <button
          type="button"
          onClick={exit}
          className="inline-flex items-center gap-2 border border-white/14 bg-black/50 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60"
        >
          <ArrowLeft size={16} />
          {exitLabel}
        </button>
      </div>

      {!debugOpen ? (
        <div className="pointer-events-none fixed bottom-4 left-4 z-20 w-[min(520px,calc(100vw-2rem))] border border-white/12 bg-[#070b10]/72 p-3 text-xs leading-5 text-stone-300 backdrop-blur">
          <span className="inline-flex items-center gap-2 text-cyan-100">
            <MousePointer2 size={14} />
            {pointerLocked ? "WASD to walk through the splat. Move the mouse to look." : "Lock mouse to walk through the splat with WASD."}
          </span>
        </div>
      ) : null}

      <div className="fixed bottom-4 right-4 z-30 w-[min(440px,calc(100vw-2rem))]">
        <div className="flex justify-end">
          <button
            type="button"
            aria-expanded={debugOpen}
            onClick={() => setDebugOpen((current) => !current)}
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
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">Spark splat viewer</p>
                <p className="mt-2 break-all text-xs leading-5 text-stone-300">{loadStatus}</p>
              </div>
              <button
                type="button"
                onClick={resetCamera}
                className="inline-flex min-h-10 items-center gap-2 border border-white/14 px-3 text-xs text-stone-100 transition hover:border-cyan-200/60"
              >
                <RotateCcw size={14} />
                Respawn
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Scene</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {scenes.map((candidate, index) => {
                  const hasSplat = Boolean(sceneSplats[candidate.id]);
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => {
                        document.exitPointerLock?.();
                        setSelectedSceneIndex(index);
                      }}
                      className={`min-h-10 border px-3 text-xs transition ${
                        index === safeSceneIndex
                          ? "border-cyan-200 bg-cyan-200 text-slate-950"
                          : hasSplat
                            ? "border-white/14 text-stone-200 hover:border-cyan-200/60"
                            : "border-white/10 text-stone-500"
                      }`}
                      title={candidate.title}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Splat file</p>
              <p className="mt-2 break-all text-xs leading-5 text-stone-400">{splatUrl ?? "No cached splat for this scene"}</p>
              <p className="mt-2 break-all text-xs leading-5 text-stone-500">{colliderUrl ? `Collider: ${colliderUrl}` : "No cached collider for this scene"}</p>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Splat transform</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NumberControl label="Scale" value={transform.scale} step={0.1} min={0.01} onChange={(value) => updateTransform({ scale: value })} />
                <NumberControl label="X rot" value={transform.rotation[0]} step={15} onChange={(value) => updateTransform({ rotation: [value, transform.rotation[1], transform.rotation[2]] })} />
                <NumberControl label="Y rot" value={transform.rotation[1]} step={15} onChange={(value) => updateTransform({ rotation: [transform.rotation[0], value, transform.rotation[2]] })} />
                <NumberControl label="Z rot" value={transform.rotation[2]} step={15} onChange={(value) => updateTransform({ rotation: [transform.rotation[0], transform.rotation[1], value] })} />
                <NumberControl label="X" value={transform.position[0]} step={0.25} onChange={(value) => updateTransform({ position: [value, transform.position[1], transform.position[2]] })} />
                <NumberControl label="Y" value={transform.position[1]} step={0.25} onChange={(value) => updateTransform({ position: [transform.position[0], value, transform.position[2]] })} />
                <NumberControl label="Z" value={transform.position[2]} step={0.25} onChange={(value) => updateTransform({ position: [transform.position[0], transform.position[1], value] })} />
                <button
                  type="button"
                  onClick={resetSplatTransform}
                  className="min-h-10 border border-white/14 px-3 text-xs text-stone-200 transition hover:border-cyan-200/60"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setColliderVisible((current) => !current)}
                  disabled={!colliderUrl}
                  className={`min-h-10 border px-3 text-xs transition ${
                    colliderVisible
                      ? "border-emerald-200 bg-emerald-200 text-slate-950"
                      : "border-white/14 text-stone-200 hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                >
                  Collider
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function applySplatTransform(splat: Object3D, transform: SplatTransform) {
  splat.position.set(...transform.position);
  splat.rotation.set(
    degreesToRadians(transform.rotation[0]),
    degreesToRadians(transform.rotation[1]),
    degreesToRadians(transform.rotation[2])
  );
  splat.scale.setScalar(transform.scale);
}

function cameraLookAtOrigin(camera: PerspectiveCamera) {
  const dx = -camera.position.x;
  const dz = -camera.position.z;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

  return {
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(camera.position.y, horizontalDistance)
  };
}

function updateMovement(camera: PerspectiveCamera, keys: Set<string>, yaw: number, delta: number, colliders: Object3D[]) {
  tempForward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  tempRight.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
  tempMove.set(0, 0, 0);

  if (keys.has("KeyW")) tempMove.add(tempForward);
  if (keys.has("KeyS")) tempMove.sub(tempForward);
  if (keys.has("KeyD")) tempMove.add(tempRight);
  if (keys.has("KeyA")) tempMove.sub(tempRight);

  if (tempMove.lengthSq() === 0) {
    return;
  }

  const speedMultiplier = keys.has("ShiftLeft") || keys.has("ShiftRight") ? SPRINT_MULTIPLIER : 1;
  tempMove.normalize().multiplyScalar(WALK_SPEED * speedMultiplier * delta);

  tempAxisMove.set(tempMove.x, 0, 0);
  if (!collidesWithScene(camera, tempAxisMove, colliders)) {
    camera.position.add(tempAxisMove);
  }

  tempAxisMove.set(0, 0, tempMove.z);
  if (!collidesWithScene(camera, tempAxisMove, colliders)) {
    camera.position.add(tempAxisMove);
  }
}

function collidesWithScene(camera: PerspectiveCamera, move: Vector3, colliders: Object3D[]) {
  if (colliders.length === 0 || move.lengthSq() === 0) {
    return false;
  }

  tempMoveDirection.copy(move).normalize();
  tempMovePerp.set(-tempMoveDirection.z, 0, tempMoveDirection.x);

  const currentFeetY = camera.position.y - PLAYER_HEIGHT;
  const distance = move.length() + COLLISION_RADIUS + 0.04;

  for (const height of COLLISION_HEIGHTS) {
    for (const sideOffset of COLLISION_SIDE_OFFSETS) {
      tempRayOrigin
        .copy(camera.position)
        .addScaledVector(tempMovePerp, sideOffset)
        .setY(currentFeetY + height);

      movementRaycaster.set(tempRayOrigin, tempMoveDirection);
      movementRaycaster.far = distance;

      if (rayHitsBlockingSurface(colliders)) {
        return true;
      }
    }
  }

  return false;
}

function rayHitsBlockingSurface(colliders: Object3D[]) {
  const hits = movementRaycaster.intersectObjects(colliders, true);

  for (const hit of hits) {
    if (!hit.face) {
      return true;
    }

    tempNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (Math.abs(tempNormal.y) <= 0.65) {
      return true;
    }
  }

  return false;
}

function updateVerticalPhysics(camera: PerspectiveCamera, delta: number, colliders: Object3D[], verticalVelocity: number) {
  if (colliders.length === 0) {
    camera.position.y = PLAYER_HEIGHT;
    return 0;
  }

  const ground = findGroundY(camera, colliders);
  if (ground === null) {
    return 0;
  }

  let nextVelocity = verticalVelocity + GRAVITY * delta;
  camera.position.y += nextVelocity * delta;

  const floorY = ground + PLAYER_HEIGHT;
  if (nextVelocity <= 0 && camera.position.y <= floorY + GROUND_SNAP_DISTANCE) {
    camera.position.y = floorY;
    nextVelocity = 0;
  }

  return nextVelocity;
}

function findGroundY(camera: PerspectiveCamera, colliders: Object3D[]) {
  groundRaycaster.set(
    tempRayOriginFrom(camera.position, 0, GROUND_PROBE_HEIGHT, 0),
    tempNormal.set(0, -1, 0)
  );
  groundRaycaster.far = GROUND_PROBE_DEPTH;

  const hits = groundRaycaster.intersectObjects(colliders, true);
  for (const hit of hits) {
    if (!hit.face) {
      continue;
    }

    const currentFeetY = camera.position.y - PLAYER_HEIGHT;
    if (hit.point.y > currentFeetY + MAX_STEP_HEIGHT) {
      continue;
    }

    tempNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (tempNormal.y > 0.45) {
      return hit.point.y;
    }
  }

  return null;
}

function tempRayOriginFrom(position: Vector3, x: number, y: number, z: number) {
  return tempRayOrigin.set(position.x + x, position.y + y, position.z + z);
}

function firstSplatSceneIndex(scenes: ScenePlan[], sceneSplats: Record<string, string | null>) {
  const index = scenes.findIndex((scene) => sceneSplats[scene.id]);
  return Math.max(index, 0);
}

function NumberControl({
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.14em] text-stone-500">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 min-h-9 w-full border border-white/14 bg-black/35 px-2 text-xs text-stone-100 outline-none focus:border-cyan-200/70"
      />
    </label>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
