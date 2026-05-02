"use client";

import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ArrowLeft, Glasses, Loader2, MousePointer2, Pause, Play, RefreshCcw, RotateCcw, Settings, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  BoxHelper,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  DoubleSide,
  Euler,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Intersection
} from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";

import {
  createDefaultSplatControlProviders,
  readXRGamepadButtonPressed,
  readXRInputSnapshot,
  XR_STANDARD_A_BUTTON_INDEX,
  XR_STANDARD_TRIGGER_BUTTON_INDEX,
  type XRInputSnapshot,
  type SplatControlProvider
} from "@/components/three/splatControls";
import { createRigVerticalPhysicsState, updateRigVerticalPhysics } from "@/components/three/splatPhysics";
import {
  DEMO_SPLAT_MANIFEST_URL,
  firstSplatSceneIndex,
  nextSplatSceneIndex,
  type DemoSplatManifest
} from "@/lib/demoSplats";
import type { SceneObjectModelMap } from "@/lib/objectModels";
import type { ScenePlan } from "@/lib/sceneSchema";

export type WorldViewerProps = {
  scenes: ScenePlan[];
  sceneImages: Record<string, string | null>;
  sceneColliders?: Record<string, string | null>;
  sceneSplats?: Record<string, string | null>;
  objectModels: SceneObjectModelMap;
  onExit: () => void;
  exitLabel?: string;
  controlProviders?: SplatControlProvider[];
};

type SplatTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

type CaptionCue = {
  end: number;
  start: number;
  text: string;
};

type SceneNarrationResponse = {
  audioUrl: string | null;
  captions: CaptionCue[];
  modelId: string;
  sceneId: string;
  script: string;
  voiceId: string | null;
  warning?: string;
};

type NarrationCacheEntry =
  | { status: "ready"; response: SceneNarrationResponse }
  | { status: "error"; message: string };

type SelectableSplat = {
  colliderPath: string | null;
  label: string;
  path: string;
  version: string;
};

type XRTextPanel = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  rotationZOffset: number;
  texture: CanvasTexture;
};

type XRQualityTier = {
  fpsRecoveryThreshold: number;
  fpsStepDownThreshold: number;
  label: string;
  lodRenderScale: number;
  lodSplatCount: number;
  maxPixelRadius: number;
  maxStdDev: number;
  minPixelRadius: number;
  minSortIntervalMs: number;
};

type ViewerDebugMetrics = {
  activeSplats: number;
  bvhColliders: number;
  colliderMeshes: number;
  fps: number;
  xrQuality: string;
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
const COLLISION_RADIUS = 0.22;
const COLLISION_HEIGHTS = [0.36, 0.78];
const COLLISION_SIDE_OFFSETS = [0];
const LOOK_SENSITIVITY = 0.0022;
const TRANSITION_REVEAL_DELAY = 140;
const TRANSITION_SWAP_DELAY = 160;
const XR_FRAMEBUFFER_SCALE = 0.76;
const XR_FOVEATION = 0.85;
const XR_QUALITY_TIERS: XRQualityTier[] = [
  {
    fpsRecoveryThreshold: 70,
    fpsStepDownThreshold: 58,
    label: "balanced",
    lodRenderScale: 1.65,
    lodSplatCount: 600_000,
    maxPixelRadius: 224,
    maxStdDev: Math.sqrt(6.5),
    minPixelRadius: 0.3,
    minSortIntervalMs: 50
  },
  {
    fpsRecoveryThreshold: 72,
    fpsStepDownThreshold: 54,
    label: "fast",
    lodRenderScale: 2.25,
    lodSplatCount: 425_000,
    maxPixelRadius: 176,
    maxStdDev: Math.sqrt(5.5),
    minPixelRadius: 0.4,
    minSortIntervalMs: 70
  },
  {
    fpsRecoveryThreshold: 72,
    fpsStepDownThreshold: 50,
    label: "rescue",
    lodRenderScale: 3.25,
    lodSplatCount: 275_000,
    maxPixelRadius: 128,
    maxStdDev: Math.sqrt(4),
    minPixelRadius: 0.55,
    minSortIntervalMs: 90
  }
];
const INITIAL_XR_QUALITY_TIER = XR_QUALITY_TIERS[0]!;
const tempAxisMove = new Vector3();
const tempMoveDirection = new Vector3();
const tempMovePerp = new Vector3();
const tempRayOrigin = new Vector3();
const tempRigPreviousPosition = new Vector3();
const tempSize = new Vector3();
const tempNormal = new Vector3();
const tempXRCameraEuler = new Euler(0, 0, 0, "YXZ");
const tempXRCameraQuaternion = new Quaternion();
const movementRaycaster = new Raycaster();
const movementHits: Intersection[] = [];
const COLLIDER_DEBUG_MATERIAL = new MeshBasicMaterial({
  color: 0x34d399,
  depthTest: false,
  depthWrite: false,
  side: DoubleSide,
  transparent: true,
  opacity: 0.62
});

BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

export function WorldViewer({
  controlProviders,
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
  const rigRef = useRef<Group | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const splatRef = useRef<SplatMesh | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transitionTimeoutsRef = useRef<number[]>([]);
  const xrSessionRef = useRef<XRSession | null>(null);
  const xrNarrationHudRef = useRef<XRTextPanel | null>(null);
  const xrCaptionPanelRef = useRef<XRTextPanel | null>(null);
  const controlProvidersRef = useRef<SplatControlProvider[]>([]);
  const playPauseNarrationFromGestureRef = useRef<() => void>(() => undefined);
  const advanceSceneFromGestureRef = useRef<() => void>(() => undefined);
  const lastNarrationGestureAtRef = useRef(0);
  const xrButtonPressedRef = useRef({ rightA: false, rightTrigger: false });
  const xrQualityTierRef = useRef(0);
  const xrFrameStatsRef = useRef({
    lastSampleAt: 0,
    lastStateUpdateAt: 0,
    recoverySamples: 0,
    slowSamples: 0
  });
  const captionFallbackTimersRef = useRef<number[]>([]);
  const keysRef = useRef(new Set<string>());
  const verticalPhysicsStateRef = useRef(createRigVerticalPhysicsState());
  const verticalVelocityRef = useRef(0);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [colliderVisible, setColliderVisible] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [xrSupported, setXrSupported] = useState(false);
  const [xrActive, setXrActive] = useState(false);
  const [xrStarting, setXrStarting] = useState(false);
  const [xrError, setXrError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugMetrics, setDebugMetrics] = useState<ViewerDebugMetrics>({
    activeSplats: 0,
    bvhColliders: 0,
    colliderMeshes: 0,
    fps: 0,
    xrQuality: "desktop"
  });
  const [loadResult, setLoadResult] = useState<{ url: string; message: string } | null>(null);
  const [narrationCache, setNarrationCache] = useState<Record<string, NarrationCacheEntry>>({});
  const [narrationLoadingSceneId, setNarrationLoadingSceneId] = useState<string | null>(null);
  const [narrationPlaying, setNarrationPlaying] = useState(false);
  const [activeCaptionIndex, setActiveCaptionIndex] = useState(0);
  const [selectedSplats, setSelectedSplats] = useState<Record<string, string>>({});
  const [splatManifest, setSplatManifest] = useState<DemoSplatManifest | null>(null);
  const [transitionCovered, setTransitionCovered] = useState(false);
  const [transforms, setTransforms] = useState<Record<string, SplatTransform>>({});
  const availableSceneSplats = useMemo(
    () => Object.fromEntries(
      scenes.map((candidate) => [
        candidate.id,
        sceneSplats[candidate.id] ?? splatManifest?.[candidate.id]?.path ?? candidate.integrations?.walkableWorld?.splatUrl ?? null
      ])
    ) as Record<string, string | null>,
    [sceneSplats, scenes, splatManifest]
  );
  const sceneIndex = selectedSceneIndex ?? firstSplatSceneIndex(scenes, availableSceneSplats);
  const safeSceneIndex = Math.max(0, Math.min(sceneIndex, scenes.length - 1));
  const scene = scenes[safeSceneIndex] ?? scenes[0];
  const sceneId = scene?.id;
  const splatOptions = useMemo(
    () => scene ? splatOptionsForScene(scene, sceneSplats[scene.id] ?? null, sceneColliders[scene.id] ?? null, splatManifest) : [],
    [scene, sceneColliders, sceneSplats, splatManifest]
  );
  const selectedSplatPath = sceneId ? selectedSplats[sceneId] : undefined;
  const selectedSplat = splatOptions.find((option) => option.path === selectedSplatPath) ?? splatOptions[0] ?? null;
  const colliderUrl = selectedSplat?.colliderPath ?? null;
  const splatUrl = selectedSplat?.path ?? null;
  const transform = scene ? transforms[scene.id] ?? DEFAULT_SPLAT_TRANSFORM : DEFAULT_SPLAT_TRANSFORM;
  const narrationEntry = sceneId ? narrationCache[sceneId] : undefined;
  const narrationResponse = narrationEntry?.status === "ready" ? narrationEntry.response : null;
  const activeCaption = narrationResponse?.captions[activeCaptionIndex] ?? null;
  const narrationUnavailable = narrationResponse?.warning || (narrationEntry?.status === "error" ? narrationEntry.message : null);
  const narrationLoading = Boolean(sceneId && narrationLoadingSceneId === sceneId);
  const loadStatus = !splatUrl
    ? "No cached splat for this scene. Generate and cache it from /worldlabs."
    : loadResult?.url === splatUrl
      ? loadResult.message
      : `Loading ${splatUrl}`;
  const resolvedControlProviders = useMemo(
    () => controlProviders ?? createDefaultSplatControlProviders(),
    [controlProviders]
  );

  useEffect(() => {
    setNarrationCache((current) => {
      let changed = false;
      const next = { ...current };

      for (const candidate of scenes) {
        if (next[candidate.id]) {
          continue;
        }

        const integrated = narrationResponseFromScene(candidate);
        if (integrated) {
          next[candidate.id] = { status: "ready", response: integrated };
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [scenes]);

  useEffect(() => {
    controlProvidersRef.current = resolvedControlProviders;
  }, [resolvedControlProviders]);

  const clearTransitionTimeouts = useCallback(() => {
    for (const timeout of transitionTimeoutsRef.current) {
      window.clearTimeout(timeout);
    }
    transitionTimeoutsRef.current = [];
  }, []);

  const queueTransitionTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = window.setTimeout(() => {
      transitionTimeoutsRef.current = transitionTimeoutsRef.current.filter((candidate) => candidate !== timeout);
      callback();
    }, delay);
    transitionTimeoutsRef.current.push(timeout);
  }, []);

  const pauseNarrationForTransition = useCallback(() => {
    for (const timer of captionFallbackTimersRef.current) {
      window.clearTimeout(timer);
    }
    captionFallbackTimersRef.current = [];

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    setNarrationPlaying(false);
    setActiveCaptionIndex(0);
  }, []);

  const beginSplatTransition = useCallback((callback: () => void) => {
    clearTransitionTimeouts();
    pauseNarrationForTransition();
    document.exitPointerLock?.();
    setTransitionCovered(true);
    queueTransitionTimeout(callback, TRANSITION_SWAP_DELAY);
  }, [clearTransitionTimeouts, pauseNarrationForTransition, queueTransitionTimeout]);

  const goToRelativeSplat = useCallback((direction: -1 | 1) => {
    if (!scene || splatOptions.length === 0) {
      return;
    }

    const currentSplatIndex = Math.max(0, splatOptions.findIndex((option) => option.path === splatUrl));
    const nextSplatIndex = currentSplatIndex + direction;

    if (nextSplatIndex >= 0 && nextSplatIndex < splatOptions.length) {
      const nextPath = splatOptions[nextSplatIndex].path;
      const sceneIdForSelection = scene.id;
      beginSplatTransition(() => {
        setSelectedSplats((current) => ({
          ...current,
          [sceneIdForSelection]: nextPath
        }));
      });
      return;
    }

    const nextSceneIndex = safeSceneIndex + direction;
    if (nextSceneIndex < 0 || nextSceneIndex >= scenes.length) {
      return;
    }

    const nextScene = scenes[nextSceneIndex];
    if (!nextScene) {
      return;
    }

    const nextSceneOptions = splatOptionsForScene(
      nextScene,
      sceneSplats[nextScene.id] ?? null,
      sceneColliders[nextScene.id] ?? null,
      splatManifest
    );
    if (nextSceneOptions.length === 0) {
      return;
    }

    beginSplatTransition(() => {
      setSelectedSceneIndex(nextSceneIndex);
      setSelectedSplats((current) => ({
        ...current,
        [nextScene.id]: direction > 0 ? nextSceneOptions[0].path : nextSceneOptions[nextSceneOptions.length - 1].path
      }));
    });
  }, [beginSplatTransition, safeSceneIndex, scene, sceneColliders, scenes, sceneSplats, splatManifest, splatOptions, splatUrl]);

  useEffect(() => () => {
    clearTransitionTimeouts();
  }, [clearTransitionTimeouts]);

  useEffect(() => {
    let canceled = false;

    fetch(DEMO_SPLAT_MANIFEST_URL, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<DemoSplatManifest> : null)
      .then((manifest) => {
        if (!canceled) {
          setSplatManifest(manifest);
        }
      })
      .catch(() => {
        if (!canceled) {
          setSplatManifest(null);
        }
      });

    return () => {
      canceled = true;
    };
  }, []);

  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    const rig = rigRef.current;
    if (!camera || !rig) {
      return;
    }

    keysRef.current.clear();
    verticalVelocityRef.current = 0;
    verticalPhysicsStateRef.current = createRigVerticalPhysicsState();
    rig.position.set(0, 0, START_Z);
    rig.rotation.set(0, 0, 0);
    const inXR = Boolean(xrSessionRef.current);
    camera.position.set(0, inXR ? 0 : PLAYER_HEIGHT, 0);
    camera.rotation.set(0, 0, 0);
    const look = cameraLookAtOrigin(rig.position.x, PLAYER_HEIGHT, rig.position.z);
    yawRef.current = look.yaw;
    pitchRef.current = look.pitch;
    if (!inXR) {
      rig.rotation.y = look.yaw;
      camera.rotation.set(look.pitch, 0, 0, "YXZ");
    }
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
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
    renderer.xr.cameraAutoUpdate = false;
    renderer.xr.setFramebufferScaleFactor(XR_FRAMEBUFFER_SCALE);
    renderer.xr.setFoveation(XR_FOVEATION);
    mountElement.append(renderer.domElement);

    const threeScene = new Scene();
    threeScene.background = new Color("#05070b");

    const camera = new PerspectiveCamera(70, mountElement.clientWidth / mountElement.clientHeight, 0.05, 1000);
    const playerRig = new Group();
    playerRig.position.set(0, 0, START_Z);
    camera.position.set(0, PLAYER_HEIGHT, 0);
    playerRig.add(camera);
    threeScene.add(playerRig);

    const narrationHud = createXRTextPanel({ width: 160, height: 160, worldWidth: 0.16, worldHeight: 0.16 });
    narrationHud.mesh.position.set(0.5, -0.46, -1.35);
    narrationHud.mesh.visible = false;
    camera.add(narrationHud.mesh);
    xrNarrationHudRef.current = narrationHud;

    const captionPanel = createXRTextPanel({ width: 1400, height: 320, worldWidth: 1.9, worldHeight: 0.43 });
    captionPanel.mesh.position.set(0, -0.86, -1.55);
    captionPanel.mesh.visible = false;
    camera.add(captionPanel.mesh);
    xrCaptionPanelRef.current = captionPanel;

    const sparkRenderer = new SparkRenderer({
      ...INITIAL_XR_QUALITY_TIER,
      renderer,
      enableLod: true,
      onDirty: () => undefined
    });
    threeScene.add(sparkRenderer);

    rendererRef.current = renderer;
    sparkRendererRef.current = sparkRenderer;
    cameraRef.current = camera;
    rigRef.current = playerRig;
    sceneRef.current = threeScene;

    const clock = new Clock();
    const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
    const onControllerNarrationToggle = () => {
      triggerNarrationGesture();
    };

    for (const controller of controllers) {
      controller.addEventListener("selectstart", onControllerNarrationToggle);
      threeScene.add(controller);
    }

    function triggerNarrationGesture() {
      const now = performance.now();
      if (lastNarrationGestureAtRef.current > 0 && now - lastNarrationGestureAtRef.current < 180) {
        return;
      }

      lastNarrationGestureAtRef.current = now;
      playPauseNarrationFromGestureRef.current();
    }

    function pollXRButtonActions(input: XRInputSnapshot | null, session: XRSession | null) {
      const rightTriggerPressed = input
        ? input.rightButtons.has(XR_STANDARD_TRIGGER_BUTTON_INDEX)
        : readXRGamepadButtonPressed(session, "right", XR_STANDARD_TRIGGER_BUTTON_INDEX);
      const rightAPressed = input
        ? input.rightButtons.has(XR_STANDARD_A_BUTTON_INDEX)
        : readXRGamepadButtonPressed(session, "right", XR_STANDARD_A_BUTTON_INDEX);
      const previous = xrButtonPressedRef.current;

      if (rightTriggerPressed && !previous.rightTrigger) {
        triggerNarrationGesture();
      }

      if (rightAPressed && !previous.rightA) {
        advanceSceneFromGestureRef.current();
      }

      previous.rightTrigger = rightTriggerPressed;
      previous.rightA = rightAPressed;
    }

    function animate() {
      const delta = Math.min(clock.getDelta(), 0.05);
      const isXR = renderer.xr.isPresenting;
      let controlCamera: Camera = camera;
      let xrInput: XRInputSnapshot | null = null;
      tempRigPreviousPosition.copy(playerRig.position);

      if (isXR) {
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        renderer.xr.updateCamera(camera);
        controlCamera = renderer.xr.getCamera();
        xrInput = readXRInputSnapshot(xrSessionRef.current);
        pollXRButtonActions(xrInput, xrSessionRef.current);
      } else {
        xrButtonPressedRef.current.rightTrigger = false;
        xrButtonPressedRef.current.rightA = false;
        camera.position.set(0, PLAYER_HEIGHT, 0);
        playerRig.rotation.y = yawRef.current;
        camera.rotation.set(pitchRef.current, 0, 0, "YXZ");
      }

      for (const provider of controlProvidersRef.current) {
        provider({
          camera: controlCamera,
          delta,
          isXR,
          keys: keysRef.current,
          rig: playerRig,
          webXRSession: xrSessionRef.current,
          xrInput,
          yaw: yawRef.current
        });
      }

      updateXRTextPanelOrientation(narrationHud, controlCamera, isXR);
      updateXRTextPanelOrientation(captionPanel, controlCamera, isXR);

      constrainRigHorizontalMovement(playerRig, tempRigPreviousPosition, colliderObjectsRef.current);
      verticalVelocityRef.current = updateRigVerticalPhysics(
        playerRig,
        delta,
        colliderObjectsRef.current,
        verticalVelocityRef.current,
        verticalPhysicsStateRef.current
      );
      updateXRQuality({
        delta,
        isXR,
        setDebugMetrics,
        sparkRenderer,
        tierRef: xrQualityTierRef,
        statsRef: xrFrameStatsRef
      });

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
      xrSessionRef.current?.end().catch(() => undefined);
      xrSessionRef.current = null;
      for (const controller of controllers) {
        controller.removeEventListener("selectstart", onControllerNarrationToggle);
        threeScene.remove(controller);
      }
      disposeXRTextPanel(narrationHud);
      disposeXRTextPanel(captionPanel);
      xrNarrationHudRef.current = null;
      xrCaptionPanelRef.current = null;
      splatRef.current?.dispose();
      splatRef.current = null;
      if (colliderBoundsRef.current) {
        threeScene.remove(colliderBoundsRef.current);
        colliderBoundsRef.current.geometry.dispose();
      }
      colliderBoundsRef.current = null;
      if (colliderRef.current) {
        threeScene.remove(colliderRef.current);
        disposeColliderGroup(colliderRef.current);
      }
      colliderRef.current = null;
      colliderObjectsRef.current = [];
      threeScene.remove(playerRig);
      sparkRenderer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sparkRendererRef.current = null;
      cameraRef.current = null;
      rigRef.current = null;
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
      if (event.code === "ArrowRight" || event.code === "ArrowDown") {
        event.preventDefault();
        goToRelativeSplat(1);
        return;
      }
      if (event.code === "ArrowLeft" || event.code === "ArrowUp") {
        event.preventDefault();
        goToRelativeSplat(-1);
        return;
      }

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
  }, [goToRelativeSplat]);

  useEffect(() => {
    let active = true;

    if (!navigator.xr) {
      setXrSupported(false);
      return;
    }

    navigator.xr.isSessionSupported("immersive-vr")
      .then((supported) => {
        if (active) {
          setXrSupported(supported);
        }
      })
      .catch(() => {
        if (active) {
          setXrSupported(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const restoreDesktopCamera = useCallback(() => {
    const camera = cameraRef.current;
    const rig = rigRef.current;
    if (!camera || !rig) {
      return;
    }

    yawRef.current = rig.rotation.y;
    camera.position.set(0, PLAYER_HEIGHT, 0);
    camera.rotation.set(pitchRef.current, 0, 0, "YXZ");
  }, []);

  const enterVR = useCallback(async () => {
    const renderer = rendererRef.current;
    if (!renderer || !navigator.xr || xrSessionRef.current) {
      return;
    }

    setXrStarting(true);
    setXrError(null);
    try {
      renderer.xr.setFramebufferScaleFactor(XR_FRAMEBUFFER_SCALE);
      renderer.xr.setFoveation(XR_FOVEATION);
      applyXRQualityTier(sparkRendererRef.current, INITIAL_XR_QUALITY_TIER);
      xrQualityTierRef.current = 0;
      const session = await navigator.xr.requestSession("immersive-vr", {
        requiredFeatures: ["local-floor"],
        optionalFeatures: ["bounded-floor"]
      });

      document.exitPointerLock?.();
      keysRef.current.clear();
      xrSessionRef.current = session;
      setPointerLocked(false);
      setXrActive(true);

      const onSessionEnd = () => {
        session.removeEventListener("end", onSessionEnd);
        if (xrSessionRef.current === session) {
          xrSessionRef.current = null;
        }
        keysRef.current.clear();
        setXrActive(false);
        setXrStarting(false);
        restoreDesktopCamera();
      };

      session.addEventListener("end", onSessionEnd);
      await renderer.xr.setSession(session);
    } catch (error) {
      xrSessionRef.current = null;
      setXrActive(false);
      setXrError(error instanceof Error ? error.message : "Could not start WebXR.");
    } finally {
      setXrStarting(false);
    }
  }, [restoreDesktopCamera]);

  const exitVR = useCallback(() => {
    xrSessionRef.current?.end().catch((error: unknown) => {
      setXrError(error instanceof Error ? error.message : "Could not exit WebXR.");
    });
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
      setTransitionCovered(false);
      return;
    }

    setTransitionCovered(true);
    let active = true;
    const splat = new SplatMesh({
      lod: true,
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
        resetCamera();
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
        queueTransitionTimeout(() => {
          if (active) {
            setTransitionCovered(false);
          }
        }, TRANSITION_REVEAL_DELAY);
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
        setTransitionCovered(false);
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
  }, [queueTransitionTimeout, resetCamera, sceneId, splatUrl]);

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
      disposeColliderGroup(colliderRef.current);
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
        let bvhColliders = 0;
        collider.traverse((object) => {
          if (object instanceof Mesh) {
            object.frustumCulled = false;
            object.material = COLLIDER_DEBUG_MATERIAL;
            object.renderOrder = 999;
            object.geometry.computeBoundsTree();
            bvhColliders += 1;
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
        setDebugMetrics((current) => ({
          ...current,
          bvhColliders,
          colliderMeshes: meshes.length
        }));
      },
      undefined,
      () => {
        if (active) {
          colliderObjectsRef.current = [];
          setDebugMetrics((current) => ({
            ...current,
            bvhColliders: 0,
            colliderMeshes: 0
          }));
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
        disposeColliderGroup(colliderRef.current);
        colliderRef.current = null;
        colliderObjectsRef.current = [];
      }
      setDebugMetrics((current) => ({
        ...current,
        bvhColliders: 0,
        colliderMeshes: 0
      }));
    };
  }, [colliderUrl]);

  const lockPointer = useCallback(() => {
    if (xrActive) {
      return;
    }
    rendererRef.current?.domElement.requestPointerLock();
  }, [xrActive]);

  const exit = useCallback(() => {
    document.exitPointerLock?.();
    xrSessionRef.current?.end().catch(() => undefined);
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
    resetCamera();
    setTransforms((current) => ({
      ...current,
      [scene.id]: DEFAULT_SPLAT_TRANSFORM
    }));
  }, [resetCamera, scene]);

  const clearCaptionFallbackPlayback = useCallback(() => {
    for (const timer of captionFallbackTimersRef.current) {
      window.clearTimeout(timer);
    }
    captionFallbackTimersRef.current = [];
  }, []);

  const playCaptionFallback = useCallback((captions: CaptionCue[]) => {
    clearCaptionFallbackPlayback();

    if (!captions.length) {
      setNarrationPlaying(false);
      setActiveCaptionIndex(0);
      return;
    }

    const startTime = performance.now();
    setActiveCaptionIndex(0);
    setNarrationPlaying(true);

    captions.forEach((caption, index) => {
      if (index === 0) {
        return;
      }

      const delay = Math.max(0, caption.start * 1000 - (performance.now() - startTime));
      captionFallbackTimersRef.current.push(window.setTimeout(() => {
        setActiveCaptionIndex(index);
      }, delay));
    });

    const lastCaption = captions[captions.length - 1];
    const endDelay = Math.max(0, (lastCaption?.end ?? 0) * 1000 - (performance.now() - startTime));
    captionFallbackTimersRef.current.push(window.setTimeout(() => {
      setNarrationPlaying(false);
      setActiveCaptionIndex(0);
      clearCaptionFallbackPlayback();
    }, endDelay));
  }, [clearCaptionFallbackPlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    clearCaptionFallbackPlayback();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }

    setNarrationPlaying(false);
    setActiveCaptionIndex(0);
  }, [clearCaptionFallbackPlayback, sceneId]);

  useEffect(() => {
    pauseNarrationForTransition();
  }, [pauseNarrationForTransition, splatUrl]);

  useEffect(() => {
    const adjacentUrls = adjacentSplatUrls({
      currentPath: splatUrl,
      currentSceneIndex: safeSceneIndex,
      manifest: splatManifest,
      sceneColliders,
      scenes,
      sceneSplats,
      splatOptions
    });

    for (const url of adjacentUrls) {
      fetch(url, { cache: "force-cache" }).catch(() => undefined);
    }
  }, [safeSceneIndex, sceneColliders, sceneSplats, scenes, splatManifest, splatOptions, splatUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !narrationResponse?.audioUrl) {
      return;
    }

    if (audio.currentSrc !== narrationResponse.audioUrl) {
      audio.src = narrationResponse.audioUrl;
      audio.load();
    }
  }, [narrationResponse?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const updateCaption = () => {
      const captions = narrationResponse?.captions ?? [];
      if (!captions.length) {
        setActiveCaptionIndex(0);
        return;
      }

      setActiveCaptionIndex(captionIndexForTime(captions, audio.currentTime));
    };

    const onEnded = () => {
      setNarrationPlaying(false);
      setActiveCaptionIndex(0);
    };

    audio.addEventListener("timeupdate", updateCaption);
    audio.addEventListener("seeked", updateCaption);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateCaption);
      audio.removeEventListener("seeked", updateCaption);
      audio.removeEventListener("ended", onEnded);
    };
  }, [narrationResponse?.captions]);

  const ensureNarrationForScene = useCallback(async (targetScene: ScenePlan, force = false) => {
    const cached = force ? undefined : narrationCache[targetScene.id];
    if (cached?.status === "error") {
      return null;
    }

    if (cached?.status === "ready") {
      return cached.response;
    }

    const integrated = force ? null : narrationResponseFromScene(targetScene);
    if (integrated) {
      setNarrationCache((current) => ({
        ...current,
        [targetScene.id]: { status: "ready", response: integrated }
      }));
      return integrated;
    }

    if (narrationLoadingSceneId === targetScene.id) {
      return null;
    }

    setNarrationLoadingSceneId(targetScene.id);
    try {
      const apiResponse = await fetch("/api/generate-scene-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, scene: targetScene })
      });
      const body = (await apiResponse.json()) as Partial<SceneNarrationResponse> & { error?: string };

      if (!apiResponse.ok) {
        throw new Error(body.error ?? "Narration request failed.");
      }

      const nextResponse: SceneNarrationResponse = {
        audioUrl: typeof body.audioUrl === "string" ? body.audioUrl : null,
        captions: Array.isArray(body.captions) ? body.captions : [],
        modelId: typeof body.modelId === "string" ? body.modelId : "",
        sceneId: typeof body.sceneId === "string" ? body.sceneId : targetScene.id,
        script: typeof body.script === "string" ? body.script : targetScene.narration,
        voiceId: typeof body.voiceId === "string" ? body.voiceId : null,
        warning: typeof body.warning === "string" ? body.warning : undefined
      };

      setNarrationCache((current) => ({
        ...current,
        [targetScene.id]: { status: "ready", response: nextResponse }
      }));
      return nextResponse;
    } catch (error) {
      setNarrationCache((current) => ({
        ...current,
        [targetScene.id]: {
          status: "error",
          message: error instanceof Error ? error.message : "Narration request failed."
        }
      }));
      setNarrationPlaying(false);
      return null;
    } finally {
      setNarrationLoadingSceneId((current) => (current === targetScene.id ? null : current));
    }
  }, [narrationCache, narrationLoadingSceneId]);

  const playPauseNarrationResponse = useCallback((response: SceneNarrationResponse, responseSceneId: string) => {
    if (!response.audioUrl) {
      if (narrationPlaying) {
        clearCaptionFallbackPlayback();
        setNarrationPlaying(false);
        setActiveCaptionIndex(0);
        return;
      }

      playCaptionFallback(response.captions);
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (narrationPlaying) {
      audio.pause();
      clearCaptionFallbackPlayback();
      setNarrationPlaying(false);
      return;
    }

    clearCaptionFallbackPlayback();
    if (audio.src !== response.audioUrl) {
      audio.src = response.audioUrl;
      audio.load();
    }

    try {
      setActiveCaptionIndex(captionIndexForTime(response.captions, audio.currentTime));
      void audio.play()
        .then(() => {
          setNarrationPlaying(true);
        })
        .catch((error: unknown) => {
          if (isMediaAbortError(error)) {
            setNarrationPlaying(false);
            return;
          }

          setNarrationCache((current) => ({
            ...current,
            [responseSceneId]: {
              status: "error",
              message: error instanceof Error ? error.message : "Could not play scene narration."
            }
          }));
          setNarrationPlaying(false);
        });
    } catch (error) {
      if (isMediaAbortError(error)) {
        setNarrationPlaying(false);
        return;
      }

      setNarrationCache((current) => ({
        ...current,
        [responseSceneId]: {
          status: "error",
          message: error instanceof Error ? error.message : "Could not play scene narration."
        }
      }));
      setNarrationPlaying(false);
    }
  }, [clearCaptionFallbackPlayback, narrationPlaying, playCaptionFallback]);

  const toggleNarration = useCallback(async () => {
    if (!scene) {
      return;
    }

    const cached = narrationCache[scene.id];
    const response = cached?.status === "ready" ? cached.response : await ensureNarrationForScene(scene);
    if (!response) {
      return;
    }

    playPauseNarrationResponse(response, scene.id);
  }, [ensureNarrationForScene, narrationCache, playPauseNarrationResponse, scene]);

  const regenerateNarration = useCallback(async () => {
    if (!scene) {
      return;
    }

    pauseNarrationForTransition();
    await ensureNarrationForScene(scene, true);
  }, [ensureNarrationForScene, pauseNarrationForTransition, scene]);

  const advanceToNextSplatScene = useCallback(() => {
    const nextIndex = nextSplatSceneIndex(scenes, availableSceneSplats, safeSceneIndex);
    if (nextIndex === null) {
      return;
    }

    beginSplatTransition(() => setSelectedSceneIndex(nextIndex));
  }, [availableSceneSplats, beginSplatTransition, safeSceneIndex, scenes]);

  useEffect(() => {
    playPauseNarrationFromGestureRef.current = () => {
      void toggleNarration();
    };
  }, [toggleNarration]);

  useEffect(() => {
    advanceSceneFromGestureRef.current = advanceToNextSplatScene;
  }, [advanceToNextSplatScene]);

  useEffect(() => {
    if (!xrActive || !scene) {
      return;
    }

    void ensureNarrationForScene(scene);
  }, [ensureNarrationForScene, scene, xrActive]);

  useEffect(() => {
    const panel = xrNarrationHudRef.current;
    if (!panel) {
      return;
    }

    panel.mesh.visible = xrActive;
    if (!xrActive) {
      return;
    }

    updateXRControlHintPanel(panel, {
      background: "rgba(4, 9, 14, 0.74)",
      border: "rgba(147, 231, 255, 0.45)",
      disabled: Boolean(narrationEntry?.status === "error" || (narrationEntry?.status === "ready" && !narrationResponse?.audioUrl && !narrationResponse?.captions.length)),
      mode: narrationPlaying || narrationLoading ? "pause" : "play"
    });
  }, [narrationEntry?.status, narrationLoading, narrationPlaying, narrationResponse?.audioUrl, narrationResponse?.captions.length, xrActive]);

  useEffect(() => {
    const panel = xrCaptionPanelRef.current;
    if (!panel) {
      return;
    }

    const visible = Boolean(xrActive && narrationPlaying && activeCaption);
    if (!visible || !activeCaption) {
      panel.mesh.visible = false;
      return;
    }

    updateXRTextPanel(panel, {
      background: "rgba(0, 0, 0, 0.72)",
      border: "rgba(255, 255, 255, 0.28)",
      lines: [
        { color: "#ffffff", font: "600 46px Arial", text: activeCaption.text }
      ]
    });
    const renderer = rendererRef.current;
    const orientationCamera = renderer?.xr.isPresenting ? renderer.xr.getCamera() : cameraRef.current;
    updateXRTextPanelOrientation(panel, orientationCamera ?? panel.mesh.parent ?? panel.mesh, xrActive);
    panel.mesh.visible = true;
  }, [activeCaption, narrationPlaying, xrActive]);

  useEffect(() => {
    const panel = xrCaptionPanelRef.current;
    if (panel && !narrationPlaying) {
      panel.mesh.visible = false;
    }
  }, [narrationPlaying]);

  useEffect(() => {
    return () => {
      clearCaptionFallbackPlayback();
      playPauseNarrationFromGestureRef.current = () => undefined;
      advanceSceneFromGestureRef.current = () => undefined;
    };
  }, [clearCaptionFallbackPlayback]);

  useEffect(() => {
    if (!xrActive) {
      if (xrNarrationHudRef.current) {
        xrNarrationHudRef.current.mesh.visible = false;
      }
      if (xrCaptionPanelRef.current) {
        xrCaptionPanelRef.current.mesh.visible = false;
      }
    }
  }, [xrActive]);

  return (
    <main className="relative h-svh w-screen overflow-hidden bg-black text-stone-50">
      <div
        ref={mountRef}
        className={`absolute inset-0 transition duration-300 ease-out ${transitionCovered ? "scale-110 blur-md brightness-125" : "scale-100 blur-0 brightness-100"}`}
      />
      <audio ref={audioRef} preload="metadata" />

      <div
        className={`papertrail-zoom-transition pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-300 ${
          transitionCovered ? "papertrail-zoom-transition-active opacity-100" : "opacity-0"
        }`}
      >
        <span className="papertrail-zoom-ring" />
        <span className="papertrail-zoom-streak papertrail-zoom-streak-a" />
        <span className="papertrail-zoom-streak papertrail-zoom-streak-b" />
        <span className="papertrail-zoom-streak papertrail-zoom-streak-c" />
      </div>

      <div className="pointer-events-none fixed left-4 top-4 z-20 w-[min(560px,calc(100vw-2rem))]">
        <div className="border border-white/12 bg-[#070b10]/75 p-4 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            Scene {safeSceneIndex + 1} of {scenes.length}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{scene?.title ?? "Splat world"}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-300">{scene?.narration ?? loadStatus}</p>
        </div>
      </div>

      <div className="pointer-events-none fixed left-1/2 top-4 z-20 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
        <div className="border border-white/12 bg-[#070b10]/72 p-3 backdrop-blur">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={toggleNarration}
              disabled={!scene || narrationLoading || Boolean(narrationEntry?.status === "error")}
              aria-label={narrationPlaying ? "Pause scene narration" : "Play scene narration"}
              className="pointer-events-auto inline-flex size-10 shrink-0 items-center justify-center border border-cyan-200/35 bg-cyan-200 text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-white/12 disabled:bg-white/10 disabled:text-stone-500"
            >
              {narrationLoading ? <Loader2 size={18} className="animate-spin" /> : narrationPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              type="button"
              onClick={regenerateNarration}
              disabled={!scene || narrationLoading}
              aria-label="Regenerate scene narration"
              title="Generate fresh narration"
              className="pointer-events-auto inline-flex size-10 shrink-0 items-center justify-center border border-white/14 bg-black/35 text-stone-100 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RefreshCcw size={16} className={narrationLoading ? "animate-spin" : ""} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-100/80">
                <Volume2 size={13} />
                Scene narration
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-100">
                {narrationLoading
                  ? "Generating narration..."
                  : narrationPlaying
                    ? "Playing scene narration."
                    : narrationResponse?.audioUrl
                      ? "Narration ready."
                      : narrationUnavailable ?? "Ready to narrate the current scene."}
              </p>
              {narrationUnavailable ? (
                <p className="mt-1 text-xs leading-5 text-amber-200/85">{narrationUnavailable}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {narrationPlaying && activeCaption ? (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-30 w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 text-center">
          <p className="inline-block max-w-full border border-white/14 bg-black/72 px-5 py-3 text-lg font-medium leading-7 text-white shadow-2xl shadow-black/45 backdrop-blur sm:text-xl sm:leading-8">
            {activeCaption.text}
          </p>
        </div>
      ) : null}

      <div className="fixed right-4 top-4 z-30 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={xrActive ? exitVR : enterVR}
          disabled={xrStarting || (!xrActive && !xrSupported)}
          className="inline-flex items-center gap-2 border border-white/14 bg-black/50 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-stone-500"
        >
          <Glasses size={16} />
          {xrActive ? "Exit VR" : xrStarting ? "Starting VR" : xrSupported ? "Enter VR" : "VR unavailable"}
        </button>
        <button
          type="button"
          onClick={lockPointer}
          disabled={xrActive}
          className="inline-flex items-center gap-2 border border-white/14 bg-black/50 px-4 py-2 text-sm text-stone-100 backdrop-blur transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-stone-500"
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
            {xrActive
              ? "Left stick moves. Right stick snap-turns. Right trigger: captions. A: next scene."
              : pointerLocked
                ? "WASD to walk through the splat. Move the mouse to look."
                : "Lock mouse to walk through the splat with WASD."}
          </span>
          {xrError ? <span className="mt-2 block text-amber-200/90">{xrError}</span> : null}
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
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-stone-400">Scene</span>
                <select
                  value={safeSceneIndex}
                  onChange={(event) => {
                    const nextIndex = Number(event.target.value);
                    beginSplatTransition(() => setSelectedSceneIndex(nextIndex));
                  }}
                  className="mt-2 min-h-10 w-full border border-white/14 bg-black/35 px-3 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70"
                >
                  {scenes.map((candidate, index) => {
                    const hasSplat = Boolean(availableSceneSplats[candidate.id]);
                    const hasCollider = Boolean(sceneColliders[candidate.id]);
                    return (
                      <option key={candidate.id} value={index} disabled={!hasSplat}>
                        {index + 1}. {candidate.title}{hasCollider ? " - collider" : ""}{hasSplat ? "" : " - no splat"}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-stone-400">Splat</span>
                <select
                  value={selectedSplat?.path ?? ""}
                  onChange={(event) => {
                    if (!scene) {
                      return;
                    }

                    const nextPath = event.target.value;
                    const sceneIdForSelection = scene.id;
                    beginSplatTransition(() => {
                      setSelectedSplats((current) => ({
                        ...current,
                        [sceneIdForSelection]: nextPath
                      }));
                    });
                  }}
                  disabled={!scene || splatOptions.length === 0}
                  className="mt-2 min-h-10 w-full border border-white/14 bg-black/35 px-3 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {splatOptions.length > 0 ? splatOptions.map((option) => (
                    <option key={option.path} value={option.path}>
                      {option.label}{option.colliderPath ? " - collider" : " - no collider"}
                    </option>
                  )) : (
                    <option value="">No cached splats</option>
                  )}
                </select>
              </label>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Splat file</p>
              <p className="mt-2 break-all text-xs leading-5 text-stone-400">{splatUrl ?? "No cached splat for this scene"}</p>
              <p className="mt-2 break-all text-xs leading-5 text-stone-500">{colliderUrl ? `Collider: ${colliderUrl}` : "No cached collider for this scene"}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-stone-300">
              <DebugMetric label="FPS" value={debugMetrics.fps > 0 ? debugMetrics.fps.toFixed(0) : "-"} />
              <DebugMetric label="XR quality" value={debugMetrics.xrQuality} />
              <DebugMetric label="Active splats" value={debugMetrics.activeSplats > 0 ? debugMetrics.activeSplats.toLocaleString() : "-"} />
              <DebugMetric label="BVH colliders" value={`${debugMetrics.bvhColliders}/${debugMetrics.colliderMeshes}`} />
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

function createXRTextPanel({
  height,
  rotationZOffset = 0,
  width,
  worldHeight,
  worldWidth
}: {
  height: number;
  rotationZOffset?: number;
  width: number;
  worldHeight: number;
  worldWidth: number;
}): XRTextPanel {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create XR text canvas.");
  }

  const texture = new CanvasTexture(canvas);
  texture.flipY = true;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  const material = new MeshBasicMaterial({
    depthTest: false,
    depthWrite: false,
    map: texture,
    transparent: true,
    toneMapped: false
  });
  const mesh = new Mesh(new PlaneGeometry(worldWidth, worldHeight), material);
  mesh.renderOrder = 1000;

  return { canvas, context, mesh, rotationZOffset, texture };
}

function updateXRTextPanelOrientation(panel: XRTextPanel, camera: Object3D, isXR: boolean) {
  if (!isXR) {
    panel.mesh.rotation.z = panel.rotationZOffset;
    return;
  }

  camera.getWorldQuaternion(tempXRCameraQuaternion);
  tempXRCameraEuler.setFromQuaternion(tempXRCameraQuaternion, "YXZ");
  panel.mesh.rotation.z = -tempXRCameraEuler.z + panel.rotationZOffset;
}

function updateXRTextPanel(
  panel: XRTextPanel,
  options: {
    background: string;
    border: string;
    lines: { color: string; font: string; text: string }[];
  }
) {
  const { canvas, context } = panel;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(0, canvas.height);
  context.scale(1, -1);
  context.fillStyle = options.background;
  roundRect(context, 20, 20, canvas.width - 40, canvas.height - 40, 34);
  context.fill();
  context.strokeStyle = options.border;
  context.lineWidth = 4;
  context.stroke();

  let y = options.lines.length > 1 ? 88 : 128;
  for (const line of options.lines) {
    context.fillStyle = line.color;
    context.font = line.font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const wrapped = wrapCanvasText(context, line.text, canvas.width - 120);
    for (const text of wrapped.slice(0, options.lines.length > 1 ? 2 : 3)) {
      context.fillText(text, canvas.width / 2, y);
      y += options.lines.length > 1 ? 54 : 58;
    }
  }

  context.restore();
  panel.texture.needsUpdate = true;
}

function updateXRControlHintPanel(
  panel: XRTextPanel,
  options: {
    background: string;
    border: string;
    disabled: boolean;
    mode: "pause" | "play";
  }
) {
  const { canvas, context } = panel;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(0, canvas.height);
  context.scale(1, -1);

  context.fillStyle = options.background;
  roundRect(context, 18, 18, canvas.width - 36, canvas.height - 36, 34);
  context.fill();
  context.strokeStyle = options.border;
  context.lineWidth = 4;
  context.stroke();

  const iconColor = options.disabled ? "rgba(248, 251, 255, 0.48)" : "#bff6ff";
  const iconX = canvas.width / 2;
  const iconY = canvas.height / 2;

  context.fillStyle = "rgba(147, 231, 255, 0.12)";
  context.beginPath();
  context.arc(iconX, iconY, 42, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(147, 231, 255, 0.28)";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = iconColor;
  if (options.mode === "pause") {
    roundRect(context, iconX - 15, iconY - 20, 10, 40, 4);
    context.fill();
    roundRect(context, iconX + 7, iconY - 20, 10, 40, 4);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(iconX - 11, iconY - 23);
    context.lineTo(iconX - 11, iconY + 23);
    context.lineTo(iconX + 25, iconY);
    context.closePath();
    context.fill();
  }

  context.restore();
  panel.texture.needsUpdate = true;
}

function disposeXRTextPanel(panel: XRTextPanel) {
  panel.mesh.geometry.dispose();
  panel.mesh.material.dispose();
  panel.texture.dispose();
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth || !line) {
      line = nextLine;
      continue;
    }

    lines.push(line);
    line = word;
  }

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [text];
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
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

function cameraLookAtOrigin(x: number, y: number, z: number) {
  const dx = -x;
  const dz = -z;
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

  return {
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(y, horizontalDistance)
  };
}

function splatOptionsForScene(
  scene: ScenePlan,
  fallbackSplat: string | null,
  fallbackCollider: string | null,
  manifest: DemoSplatManifest | null
): SelectableSplat[] {
  const entry = manifest?.[scene.id];
  const options: SelectableSplat[] = [];
  const seen = new Set<string>();

  function addOption(option: SelectableSplat) {
    if (!option.path || seen.has(option.path)) {
      return;
    }

    seen.add(option.path);
    options.push(option);
  }

  if (entry?.path) {
    addOption({
      colliderPath: entry.colliderPath ?? fallbackCollider,
      label: entry.latestVersion ? `Latest (${entry.latestVersion})` : "Latest",
      path: entry.path,
      version: entry.latestVersion ?? "latest"
    });
  }

  for (const version of entry?.versions ?? []) {
    addOption({
      colliderPath: version.colliderPath ?? (version.path === entry?.path ? entry?.colliderPath ?? fallbackCollider : null),
      label: version.version,
      path: version.path,
      version: version.version
    });
  }

  if (fallbackSplat) {
    addOption({
      colliderPath: fallbackCollider,
      label: "Current scene splat",
      path: fallbackSplat,
      version: "current"
    });
  }

  return options;
}

function adjacentSplatUrls({
  currentPath,
  currentSceneIndex,
  manifest,
  sceneColliders,
  scenes,
  sceneSplats,
  splatOptions
}: {
  currentPath: string | null;
  currentSceneIndex: number;
  manifest: DemoSplatManifest | null;
  sceneColliders: Record<string, string | null>;
  scenes: ScenePlan[];
  sceneSplats: Record<string, string | null>;
  splatOptions: SelectableSplat[];
}) {
  const urls = new Set<string>();
  const currentSplatIndex = splatOptions.findIndex((option) => option.path === currentPath);

  for (const index of [currentSplatIndex - 1, currentSplatIndex + 1]) {
    const option = splatOptions[index];
    if (option?.path) {
      urls.add(option.path);
    }
  }

  for (const sceneIndex of [currentSceneIndex - 1, currentSceneIndex + 1]) {
    const scene = scenes[sceneIndex];
    if (!scene) {
      continue;
    }

    const [option] = splatOptionsForScene(
      scene,
      sceneSplats[scene.id] ?? null,
      sceneColliders[scene.id] ?? null,
      manifest
    );
    if (option?.path) {
      urls.add(option.path);
    }
  }

  urls.delete(currentPath ?? "");
  return Array.from(urls);
}

function constrainRigHorizontalMovement(rig: Group, previousPosition: Vector3, colliders: Object3D[]) {
  if (colliders.length === 0) {
    return;
  }

  tempAxisMove.set(rig.position.x - previousPosition.x, 0, 0);
  rig.position.x = previousPosition.x;
  if (!collidesWithScene(previousPosition, tempAxisMove, colliders)) {
    rig.position.x = previousPosition.x + tempAxisMove.x;
  }

  tempAxisMove.set(0, 0, rig.position.z - previousPosition.z);
  rig.position.z = previousPosition.z;
  if (!collidesWithScene(rig.position, tempAxisMove, colliders)) {
    rig.position.z += tempAxisMove.z;
  }
}

function collidesWithScene(position: Vector3, move: Vector3, colliders: Object3D[]) {
  if (colliders.length === 0 || move.lengthSq() === 0) {
    return false;
  }

  tempMoveDirection.copy(move).normalize();
  tempMovePerp.set(-tempMoveDirection.z, 0, tempMoveDirection.x);

  const distance = move.length() + COLLISION_RADIUS + 0.02;

  for (const height of COLLISION_HEIGHTS) {
    for (const sideOffset of COLLISION_SIDE_OFFSETS) {
      tempRayOrigin
        .copy(position)
        .addScaledVector(tempMovePerp, sideOffset)
        .setY(position.y + height);

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
  movementHits.length = 0;
  movementRaycaster.firstHitOnly = true;
  movementRaycaster.intersectObjects(colliders, false, movementHits);

  for (const hit of movementHits) {
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

function isMediaAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return error instanceof Error && error.message.toLowerCase().includes("media resource was aborted");
}

function narrationResponseFromScene(scene: ScenePlan): SceneNarrationResponse | null {
  const narration = scene.integrations?.narration;

  if (!narration) {
    return null;
  }

  const captions = Array.isArray(narration.captions) ? narration.captions : [];
  const audioUrl = typeof narration.audioUrl === "string" && narration.audioUrl ? narration.audioUrl : null;

  if (!audioUrl && captions.length === 0) {
    return null;
  }

  return {
    audioUrl,
    captions,
    modelId: narration.modelId ?? "",
    sceneId: scene.id,
    script: narration.script,
    voiceId: narration.voiceId ?? null,
    warning: narration.warning
  };
}

function applyXRQualityTier(sparkRenderer: SparkRenderer | null, tier: XRQualityTier) {
  if (!sparkRenderer) {
    return;
  }

  sparkRenderer.enableLod = true;
  sparkRenderer.lodSplatCount = tier.lodSplatCount;
  sparkRenderer.lodRenderScale = tier.lodRenderScale;
  sparkRenderer.maxStdDev = tier.maxStdDev;
  sparkRenderer.minPixelRadius = tier.minPixelRadius;
  sparkRenderer.maxPixelRadius = tier.maxPixelRadius;
  sparkRenderer.minSortIntervalMs = tier.minSortIntervalMs;
  sparkRenderer.setDirty();
}

function updateXRQuality({
  delta,
  isXR,
  setDebugMetrics,
  sparkRenderer,
  statsRef,
  tierRef
}: {
  delta: number;
  isXR: boolean;
  setDebugMetrics: Dispatch<SetStateAction<ViewerDebugMetrics>>;
  sparkRenderer: SparkRenderer;
  statsRef: MutableRefObject<{
    lastSampleAt: number;
    lastStateUpdateAt: number;
    recoverySamples: number;
    slowSamples: number;
  }>;
  tierRef: MutableRefObject<number>;
}) {
  const now = performance.now();
  const fps = delta > 0 ? 1 / delta : 0;
  const stats = statsRef.current;

  if (!isXR) {
    if (tierRef.current !== 0) {
      tierRef.current = 0;
      applyXRQualityTier(sparkRenderer, INITIAL_XR_QUALITY_TIER);
    }
    stats.slowSamples = 0;
    stats.recoverySamples = 0;
  } else if (now - stats.lastSampleAt >= 500) {
    const tier = XR_QUALITY_TIERS[tierRef.current] ?? XR_QUALITY_TIERS[0];
    if (fps < tier.fpsStepDownThreshold && tierRef.current < XR_QUALITY_TIERS.length - 1) {
      stats.slowSamples += 1;
      stats.recoverySamples = 0;
      if (stats.slowSamples >= 4) {
        tierRef.current += 1;
        applyXRQualityTier(sparkRenderer, XR_QUALITY_TIERS[tierRef.current] ?? INITIAL_XR_QUALITY_TIER);
        stats.slowSamples = 0;
      }
    } else if (fps > tier.fpsRecoveryThreshold && tierRef.current > 0) {
      stats.recoverySamples += 1;
      stats.slowSamples = 0;
      if (stats.recoverySamples >= 5) {
        tierRef.current -= 1;
        applyXRQualityTier(sparkRenderer, XR_QUALITY_TIERS[tierRef.current] ?? INITIAL_XR_QUALITY_TIER);
        stats.recoverySamples = 0;
      }
    } else {
      stats.slowSamples = 0;
      stats.recoverySamples = 0;
    }
    stats.lastSampleAt = now;
  }

  if (now - stats.lastStateUpdateAt >= 500) {
    stats.lastStateUpdateAt = now;
    setDebugMetrics((current) => ({
      ...current,
      activeSplats: sparkRenderer.activeSplats,
      fps,
      xrQuality: isXR ? XR_QUALITY_TIERS[tierRef.current]?.label ?? "unknown" : "desktop"
    }));
  }
}

function disposeColliderGroup(collider: Object3D) {
  const geometries = new Set<BufferGeometry>();
  collider.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    geometries.add(object.geometry);
  });

  for (const geometry of geometries) {
    geometry.disposeBoundsTree?.();
    geometry.dispose();
  }
}

function captionIndexForTime(captions: CaptionCue[], currentTime: number) {
  if (captions.length === 0) {
    return 0;
  }

  const index = captions.findIndex((cue, cueIndex) => {
    const nextCue = captions[cueIndex + 1];
    const end = nextCue ? nextCue.start : cue.end;
    return currentTime >= cue.start && currentTime < end;
  });

  if (index >= 0) {
    return index;
  }

  return currentTime < captions[0].start ? 0 : captions.length - 1;
}

function DebugMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm text-stone-100">{value}</p>
    </div>
  );
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
