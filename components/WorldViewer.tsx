"use client";

import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ArrowLeft, Glasses, Loader2, MousePointer2, Pause, Play, RotateCcw, Settings, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AmbientLight,
  Box3,
  BoxHelper,
  CircleGeometry,
  Clock,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer,
  type Camera
} from "three";

import { DemoNpcDialog } from "@/components/DemoNpcDialog";
import {
  createDefaultSplatControlProviders,
  type SplatControlProvider
} from "@/components/three/splatControls";
import { DEMO_NPCS, DEMO_NPC_SLOTS, NPC_INTERACTION_RADIUS, rosterForPlayer } from "@/lib/demoNpcs";
import { DEMO_SPLAT_MANIFEST_URL, type DemoSplatManifest } from "@/lib/demoSplats";
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
  playerCharacterId?: string | null;
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
// World-space height for an NPC at scale=1.0. Sized just under the 1m player
// camera so the character's head sits around the player's chin.
const TARGET_NPC_HEIGHT = 0.85;
const COLLISION_RADIUS = 0.28;
const COLLISION_HEIGHTS = [0.24, 0.74];
const COLLISION_SIDE_OFFSETS = [-0.18, 0, 0.18];
const GRAVITY = -9.8;
const GROUND_PROBE_HEIGHT = 3;
const GROUND_PROBE_DEPTH = 8;
const GROUND_SNAP_DISTANCE = 0.22;
const MAX_STEP_HEIGHT = 0.22;
const LOOK_SENSITIVITY = 0.0022;
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
  controlProviders,
  scenes,
  sceneColliders = {},
  sceneSplats = {},
  onExit,
  exitLabel = "Scene cards",
  playerCharacterId = null
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
  const xrSessionRef = useRef<XRSession | null>(null);
  const controlProvidersRef = useRef<SplatControlProvider[]>([]);
  const keysRef = useRef(new Set<string>());
  const verticalVelocityRef = useRef(0);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const npcGroupsRef = useRef<Map<string, Group>>(new Map());
  const npcRingsRef = useRef<Map<string, Mesh>>(new Map());
  const npcConesRef = useRef<Map<string, Mesh>>(new Map());
  const nearestNpcIdRef = useRef<string | null>(null);
  const activeNpcIdRef = useRef<string | null>(null);
  const xrControllerCleanupRef = useRef<(() => void) | null>(null);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [colliderVisible, setColliderVisible] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [xrSupported, setXrSupported] = useState(false);
  const [xrActive, setXrActive] = useState(false);
  const [xrStarting, setXrStarting] = useState(false);
  const [xrError, setXrError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [loadResult, setLoadResult] = useState<{ url: string; message: string } | null>(null);
  const [narrationCache, setNarrationCache] = useState<Record<string, NarrationCacheEntry>>({});
  const [narrationLoadingSceneId, setNarrationLoadingSceneId] = useState<string | null>(null);
  const [narrationPlaying, setNarrationPlaying] = useState(false);
  const [activeCaptionIndex, setActiveCaptionIndex] = useState(0);
  const [selectedSplats, setSelectedSplats] = useState<Record<string, string>>({});
  const [splatManifest, setSplatManifest] = useState<DemoSplatManifest | null>(null);
  const [transforms, setTransforms] = useState<Record<string, SplatTransform>>({});
  const [nearestNpcId, setNearestNpcId] = useState<string | null>(null);
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const nearestNpc = nearestNpcId ? DEMO_NPCS.find((npc) => npc.id === nearestNpcId) ?? null : null;
  const activeNpc = activeNpcId ? DEMO_NPCS.find((npc) => npc.id === activeNpcId) ?? null : null;

  useEffect(() => {
    activeNpcIdRef.current = activeNpcId;
  }, [activeNpcId]);

  const triggerNpcInteraction = useCallback(() => {
    const id = nearestNpcIdRef.current;
    if (!id || activeNpcIdRef.current) {
      return;
    }
    setActiveNpcId(id);
  }, []);

  const closeNpcDialog = useCallback(() => {
    setActiveNpcId(null);
  }, []);
  const sceneIndex = selectedSceneIndex ?? firstSplatSceneIndex(scenes, sceneSplats);
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
    controlProvidersRef.current = resolvedControlProviders;
  }, [resolvedControlProviders]);

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
    mountElement.append(renderer.domElement);

    const threeScene = new Scene();
    threeScene.background = new Color("#05070b");

    const ambientLight = new AmbientLight(0xffffff, 0.85);
    threeScene.add(ambientLight);
    const hemiLight = new HemisphereLight(0xfff1d6, 0x2a1a10, 0.55);
    hemiLight.position.set(0, 6, 0);
    threeScene.add(hemiLight);
    const keyLight = new DirectionalLight(0xfff0d8, 1.1);
    keyLight.position.set(3, 8, 4);
    threeScene.add(keyLight);

    const camera = new PerspectiveCamera(70, mountElement.clientWidth / mountElement.clientHeight, 0.05, 1000);
    const playerRig = new Group();
    playerRig.position.set(0, 0, START_Z);
    camera.position.set(0, PLAYER_HEIGHT, 0);
    playerRig.add(camera);
    threeScene.add(playerRig);

    const sparkRenderer = new SparkRenderer({
      renderer,
      enableLod: false,
      onDirty: () => renderer.render(threeScene, camera)
    });
    threeScene.add(sparkRenderer);

    rendererRef.current = renderer;
    sparkRendererRef.current = sparkRenderer;
    cameraRef.current = camera;
    rigRef.current = playerRig;
    sceneRef.current = threeScene;

    const clock = new Clock();

    function animate() {
      const delta = Math.min(clock.getDelta(), 0.05);
      const isXR = renderer.xr.isPresenting;
      let controlCamera: Camera = camera;
      const previousRigPosition = playerRig.position.clone();

      if (isXR) {
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        renderer.xr.updateCamera(camera);
        controlCamera = renderer.xr.getCamera();
      } else {
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
          yaw: yawRef.current
        });
      }

      constrainRigHorizontalMovement(playerRig, previousRigPosition, colliderObjectsRef.current);
      if (!isXR) {
        verticalVelocityRef.current = updateRigVerticalPhysics(playerRig, delta, colliderObjectsRef.current, verticalVelocityRef.current);
      }

      groundNpcsIfNeeded(colliderObjectsRef.current);
      updateNpcProximity(playerRig.position, clock.elapsedTime);

      sparkRenderer.render(threeScene, camera);
    }

    function groundNpcsIfNeeded(colliders: Object3D[]) {
      if (colliders.length === 0) {
        return;
      }
      const groups = npcGroupsRef.current;
      if (groups.size === 0) {
        return;
      }
      // Sample the floor once at the player spawn (x=0, z=START_Z). All NPCs share
      // this single y so they stand on the same elevation regardless of awnings,
      // signs, or roof geometry that a per-NPC raycast might hit first.
      tempRayOrigin.set(0, 0, START_Z);
      const sharedGround = sampleNpcGroundY(tempRayOrigin, colliders) ?? 0;
      groups.forEach((group) => {
        if (group.userData.grounded) {
          return;
        }
        group.position.y = sharedGround;
        group.visible = true;
        group.userData.grounded = true;
      });
    }

    function updateNpcProximity(rigPosition: Vector3, elapsed: number) {
      const groups = npcGroupsRef.current;
      if (groups.size === 0) {
        if (nearestNpcIdRef.current !== null) {
          nearestNpcIdRef.current = null;
          setNearestNpcId(null);
        }
        return;
      }

      let nearestId: string | null = null;
      let nearestDistSq = NPC_INTERACTION_RADIUS * NPC_INTERACTION_RADIUS;
      groups.forEach((group, id) => {
        const dx = group.position.x - rigPosition.x;
        const dz = group.position.z - rigPosition.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearestId = id;
        }
      });

      if (nearestId !== nearestNpcIdRef.current) {
        nearestNpcIdRef.current = nearestId;
        setNearestNpcId(nearestId);
        npcRingsRef.current.forEach((ring, id) => {
          const material = ring.material as MeshBasicMaterial;
          material.opacity = id === nearestId ? 0.55 : 0.16;
          material.color.setHex(id === nearestId ? 0xa5f3fc : 0x67e8f9);
        });
        npcConesRef.current.forEach((cone, id) => {
          cone.visible = id === nearestId;
        });
      }

      if (nearestId) {
        const cone = npcConesRef.current.get(nearestId);
        if (cone) {
          cone.position.y = 1.95 + Math.sin(elapsed * 3.2) * 0.08;
        }
      }
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
      splatRef.current?.dispose();
      splatRef.current = null;
      if (colliderBoundsRef.current) {
        threeScene.remove(colliderBoundsRef.current);
        colliderBoundsRef.current.geometry.dispose();
      }
      colliderBoundsRef.current = null;
      if (colliderRef.current) {
        threeScene.remove(colliderRef.current);
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
      keysRef.current.add(event.code);
      if (event.code === "KeyE" && !activeNpcIdRef.current && nearestNpcIdRef.current) {
        event.preventDefault();
        triggerNpcInteraction();
      }
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
  }, [triggerNpcInteraction]);

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
      const session = await navigator.xr.requestSession("immersive-vr", {
        requiredFeatures: ["local-floor"],
        optionalFeatures: ["bounded-floor"]
      });

      document.exitPointerLock?.();
      keysRef.current.clear();
      xrSessionRef.current = session;
      setPointerLocked(false);
      setXrActive(true);

      const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
      const handleControllerSelect = () => {
        if (!activeNpcIdRef.current && nearestNpcIdRef.current) {
          triggerNpcInteraction();
        }
      };
      controllers.forEach((controller) => {
        controller.addEventListener("selectstart", handleControllerSelect);
      });
      xrControllerCleanupRef.current = () => {
        controllers.forEach((controller) => {
          controller.removeEventListener("selectstart", handleControllerSelect);
        });
      };

      const onSessionEnd = () => {
        session.removeEventListener("end", onSessionEnd);
        xrControllerCleanupRef.current?.();
        xrControllerCleanupRef.current = null;
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
  }, [restoreDesktopCamera, triggerNpcInteraction]);

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

  useEffect(() => {
    const threeScene = sceneRef.current;
    if (!threeScene) {
      return;
    }

    let active = true;
    const loader = new GLTFLoader();
    const npcs = new Group();
    npcs.name = "demo-npcs";
    threeScene.add(npcs);

    const ringGeometry = new CircleGeometry(0.55, 32);
    const coneGeometry = new ConeGeometry(0.12, 0.22, 12);
    const groups = new Map<string, Group>();
    const rings = new Map<string, Mesh>();
    const cones = new Map<string, Mesh>();
    const ringMaterials: MeshBasicMaterial[] = [];
    const coneMaterials: MeshBasicMaterial[] = [];

    const npcRoster = rosterForPlayer(playerCharacterId);

    npcRoster.forEach((npc, slotIndex) => {
      const slot = DEMO_NPC_SLOTS[slotIndex];

      const group = new Group();
      group.position.set(slot.position[0], slot.position[1], slot.position[2]);
      group.rotation.y = slot.rotationY;
      group.userData.npcId = npc.id;
      group.userData.grounded = false;
      group.visible = false;
      npcs.add(group);

      const ringMaterial = new MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: DoubleSide
      });
      ringMaterials.push(ringMaterial);
      const ring = new Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      ring.renderOrder = 5;
      group.add(ring);
      rings.set(npc.id, ring);

      const coneMaterial = new MeshBasicMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.92,
        depthWrite: false
      });
      coneMaterials.push(coneMaterial);
      const cone = new Mesh(coneGeometry, coneMaterial);
      cone.rotation.x = Math.PI;
      cone.position.y = 1.95;
      cone.renderOrder = 6;
      cone.visible = false;
      group.add(cone);
      cones.set(npc.id, cone);

      loader.load(`/models/sleuth/${npc.id}.glb`, (gltf) => {
        if (!active) return;
        const model = gltf.scene;

        // Normalize: measure the raw GLB height, then scale so the final character
        // height is TARGET_NPC_HEIGHT * npc.scale. Different GLB exports come in
        // wildly different sizes (Meshy outputs ~2m, others ~1m); normalizing keeps
        // every character at a believable size next to the 1m-tall player rig.
        const rawBbox = new Box3().setFromObject(model);
        const rawHeight = Math.max(rawBbox.max.y - rawBbox.min.y, 0.001);
        const finalScale = (TARGET_NPC_HEIGHT / rawHeight) * npc.scale;
        model.scale.setScalar(finalScale);

        const scaledBbox = new Box3().setFromObject(model);
        model.position.y -= scaledBbox.min.y;
        group.add(model);
      });

      groups.set(npc.id, group);
    });

    npcGroupsRef.current = groups;
    npcRingsRef.current = rings;
    npcConesRef.current = cones;
    nearestNpcIdRef.current = null;
    setNearestNpcId(null);

    return () => {
      active = false;
      threeScene.remove(npcs);
      ringGeometry.dispose();
      coneGeometry.dispose();
      ringMaterials.forEach((material) => material.dispose());
      coneMaterials.forEach((material) => material.dispose());
      groups.clear();
      rings.clear();
      cones.clear();
      npcGroupsRef.current = groups;
      npcRingsRef.current = rings;
      npcConesRef.current = cones;
      nearestNpcIdRef.current = null;
    };
  }, [sceneId, playerCharacterId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }

    setNarrationPlaying(false);
    setActiveCaptionIndex(0);
  }, [sceneId]);

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

  const toggleNarration = useCallback(async () => {
    if (!scene) {
      return;
    }

    const cached = narrationCache[scene.id];
    if (cached?.status === "error") {
      return;
    }

    let response = cached?.status === "ready" ? cached.response : null;

    if (!response) {
      setNarrationLoadingSceneId(scene.id);
      try {
        const apiResponse = await fetch("/api/generate-scene-narration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene })
        });
        const body = (await apiResponse.json()) as Partial<SceneNarrationResponse> & { error?: string };

        if (!apiResponse.ok) {
          throw new Error(body.error ?? "Narration request failed.");
        }

        const nextResponse: SceneNarrationResponse = {
          audioUrl: typeof body.audioUrl === "string" ? body.audioUrl : null,
          captions: Array.isArray(body.captions) ? body.captions : [],
          modelId: typeof body.modelId === "string" ? body.modelId : "",
          sceneId: typeof body.sceneId === "string" ? body.sceneId : scene.id,
          script: typeof body.script === "string" ? body.script : scene.narration,
          voiceId: typeof body.voiceId === "string" ? body.voiceId : null,
          warning: typeof body.warning === "string" ? body.warning : undefined
        };
        response = nextResponse;

        setNarrationCache((current) => ({
          ...current,
          [scene.id]: { status: "ready", response: nextResponse }
        }));
      } catch (error) {
        setNarrationCache((current) => ({
          ...current,
          [scene.id]: {
            status: "error",
            message: error instanceof Error ? error.message : "Narration request failed."
          }
        }));
        setNarrationPlaying(false);
        return;
      } finally {
        setNarrationLoadingSceneId(null);
      }
    }

    if (!response.audioUrl) {
      setNarrationPlaying(false);
      setActiveCaptionIndex(0);
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (narrationPlaying) {
      audio.pause();
      setNarrationPlaying(false);
      return;
    }

    if (audio.src !== response.audioUrl) {
      audio.src = response.audioUrl;
      audio.load();
    }

    try {
      setActiveCaptionIndex(captionIndexForTime(response.captions, audio.currentTime));
      await audio.play();
      setNarrationPlaying(true);
    } catch (error) {
      if (isMediaAbortError(error)) {
        setNarrationPlaying(false);
        return;
      }

      setNarrationCache((current) => ({
        ...current,
        [scene.id]: {
          status: "error",
          message: error instanceof Error ? error.message : "Could not play scene narration."
        }
      }));
      setNarrationPlaying(false);
    }
  }, [narrationCache, narrationPlaying, scene]);

  return (
    <main className="relative h-svh w-screen overflow-hidden bg-black text-stone-50">
      <div ref={mountRef} className="absolute inset-0" />
      <audio ref={audioRef} preload="metadata" />

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

      {nearestNpc && !activeNpc && !xrActive ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 -translate-x-1/2">
          <div className="border border-cyan-200/40 bg-[#070b10]/90 px-5 py-3 text-center text-stone-100 shadow-2xl shadow-black/50 backdrop-blur">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-cyan-200/80">
              {nearestNpc.role}
            </p>
            <p className="mt-1 text-sm font-semibold">{nearestNpc.name}</p>
            <p className="mt-1 text-xs text-stone-300">
              Press <span className="font-semibold text-cyan-100">E</span> to talk
            </p>
          </div>
        </div>
      ) : null}

      {activeNpc ? (
        <DemoNpcDialog key={activeNpc.id} npc={activeNpc} onClose={closeNpcDialog} />
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
              ? "Left stick moves through the splat. Right stick snap-turns."
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
                    document.exitPointerLock?.();
                    setSelectedSceneIndex(Number(event.target.value));
                  }}
                  className="mt-2 min-h-10 w-full border border-white/14 bg-black/35 px-3 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70"
                >
                  {scenes.map((candidate, index) => {
                    const hasSplat = Boolean(sceneSplats[candidate.id]);
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

                    document.exitPointerLock?.();
                    setSelectedSplats((current) => ({
                      ...current,
                      [scene.id]: event.target.value
                    }));
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

function updateRigVerticalPhysics(rig: Group, delta: number, colliders: Object3D[], verticalVelocity: number) {
  if (colliders.length === 0) {
    rig.position.y = 0;
    return 0;
  }

  const ground = findGroundY(rig.position, colliders);
  if (ground === null) {
    return 0;
  }

  let nextVelocity = verticalVelocity + GRAVITY * delta;
  rig.position.y += nextVelocity * delta;

  if (nextVelocity <= 0 && rig.position.y <= ground + GROUND_SNAP_DISTANCE) {
    rig.position.y = ground;
    nextVelocity = 0;
  }

  return nextVelocity;
}

function sampleNpcGroundY(position: Vector3, colliders: Object3D[]) {
  groundRaycaster.set(
    tempRayOrigin.set(position.x, 30, position.z),
    tempNormal.set(0, -1, 0)
  );
  groundRaycaster.far = 80;
  const hits = groundRaycaster.intersectObjects(colliders, true);
  for (const hit of hits) {
    if (!hit.face) continue;
    tempNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (tempNormal.y > 0.45) {
      return hit.point.y;
    }
  }
  return null;
}

function findGroundY(position: Vector3, colliders: Object3D[]) {
  groundRaycaster.set(
    tempRayOriginFrom(position, 0, GROUND_PROBE_HEIGHT, 0),
    tempNormal.set(0, -1, 0)
  );
  groundRaycaster.far = GROUND_PROBE_DEPTH;

  const hits = groundRaycaster.intersectObjects(colliders, true);
  for (const hit of hits) {
    if (!hit.face) {
      continue;
    }

    if (hit.point.y > position.y + MAX_STEP_HEIGHT) {
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

function isMediaAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return error instanceof Error && error.message.toLowerCase().includes("media resource was aborted");
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
