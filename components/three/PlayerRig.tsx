"use client";

import { PerspectiveCamera, PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { XROrigin, useXRStore } from "@react-three/xr";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  Group,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type PerspectiveCamera as ThreePerspectiveCamera
} from "three";

import {
  DESKTOP_MOVE_SPEED,
  layoutNavigation,
  PLAYER_HEIGHT,
  resolvePlayerPosition,
  targetKey,
  XR_MOVE_SPEED,
  XR_SNAP_TURN_DEGREES,
  type Vec3,
  type WorldTarget
} from "@/lib/sceneNavigation";
import type { LayoutType } from "@/lib/sceneSchema";

type PlayerRigProps = {
  layoutType: LayoutType;
  sceneId: string;
  resetSignal?: number;
  xrActive: boolean;
  pointerLockSelector: string;
  onPointerLockChange: (locked: boolean) => void;
  onTargetChange: (target: WorldTarget | null) => void;
  onActivateTarget: (target: WorldTarget) => void;
};

type TargetedObject = Object3D & {
  userData: {
    worldTarget?: WorldTarget;
  };
};

const CENTER = new Vector2(0, 0);
const XR_STICK_DEADZONE = 0.18;
const XR_TURN_DEADZONE = 0.65;

export function PlayerRig({
  layoutType,
  sceneId,
  resetSignal = 0,
  xrActive,
  pointerLockSelector,
  onPointerLockChange,
  onTargetChange,
  onActivateTarget
}: PlayerRigProps) {
  const { camera, gl, scene, set } = useThree();
  const xrStore = useXRStore();
  const navigation = layoutNavigation[layoutType];
  const originRef = useRef<Group | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);
  const keys = useRef(new Set<string>());
  const raycaster = useMemo(() => new Raycaster(), []);
  const lastTargetKey = useRef<string | null>(null);
  const canSnapTurn = useRef(true);

  const clearTarget = useCallback(() => {
    if (lastTargetKey.current === null) {
      return;
    }

    lastTargetKey.current = null;
    onTargetChange(null);
  }, [onTargetChange]);

  const updateTarget = useCallback(
    (target: WorldTarget | null) => {
      const nextKey = targetKey(target);
      if (nextKey === lastTargetKey.current) {
        return;
      }

      lastTargetKey.current = nextKey;
      onTargetChange(target);
    },
    [onTargetChange]
  );

  useLayoutEffect(() => {
    const origin = originRef.current;
    const playerCamera = cameraRef.current;

    if (!origin) {
      return;
    }

    origin.position.set(...navigation.spawn);
    origin.rotation.set(0, 0, 0);
    keys.current.clear();
    clearTarget();

    if (!xrActive && playerCamera) {
      playerCamera.position.set(0, PLAYER_HEIGHT, 0);
      playerCamera.rotation.set(0, 0, 0);
      set({ camera: playerCamera });
    }
  }, [clearTarget, navigation.spawn, resetSignal, sceneId, set, xrActive]);

  useEffect(() => {
    if (!xrActive) {
      return;
    }

    document.exitPointerLock?.();
    keys.current.clear();
    clearTarget();
    onPointerLockChange(false);
  }, [clearTarget, onPointerLockChange, xrActive]);

  useEffect(() => {
    if (xrActive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);

      if (event.repeat || event.code !== "KeyE") {
        return;
      }

      const target = readTargetFromKey(lastTargetKey.current);
      if (target) {
        onActivateTarget(target);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onActivateTarget, xrActive]);

  useFrame((_, delta) => {
    if (xrActive) {
      updateXRMovement(originRef.current, camera, xrStore.getState().inputSourceStates, delta, navigation, canSnapTurn);
      return;
    }

    updateDesktopMovement(originRef.current, camera, keys.current, delta, navigation);

    if (document.pointerLockElement !== gl.domElement) {
      clearTarget();
      return;
    }

    raycaster.setFromCamera(CENTER, camera);
    updateTarget(findWorldTarget(raycaster, scene));
  });

  return (
    <XROrigin ref={originRef} disabled={!xrActive}>
      {!xrActive ? <PerspectiveCamera ref={cameraRef} makeDefault position={[0, PLAYER_HEIGHT, 0]} fov={68} /> : null}
      <pointLight position={[0, PLAYER_HEIGHT, 0]} intensity={2.4} color="#dff8ff" distance={9} decay={1.45} />
      {!xrActive ? (
        <PointerLockControls
          selector={pointerLockSelector}
          onLock={() => onPointerLockChange(true)}
          onUnlock={() => {
            keys.current.clear();
            clearTarget();
            onPointerLockChange(false);
          }}
          makeDefault
        />
      ) : null}
    </XROrigin>
  );
}

function updateXRMovement(
  origin: Group | null,
  camera: Camera,
  inputSourceStates: ReturnType<ReturnType<typeof useXRStore>["getState"]>["inputSourceStates"],
  delta: number,
  navigation: (typeof layoutNavigation)[LayoutType],
  canSnapTurn: MutableRefObject<boolean>
) {
  if (!origin) {
    return;
  }

  const leftStick = readXRThumbstick(inputSourceStates, "left");
  const rightStick = readXRThumbstick(inputSourceStates, "right");
  const turnX = rightStick?.x ?? 0;

  if (Math.abs(turnX) < XR_TURN_DEADZONE) {
    canSnapTurn.current = true;
  } else if (canSnapTurn.current) {
    canSnapTurn.current = false;
    origin.rotation.y += (turnX > 0 ? -1 : 1) * degreesToRadians(XR_SNAP_TURN_DEGREES);
  }

  if (!leftStick) {
    return;
  }

  const xAxis = applyDeadzone(leftStick.x, XR_STICK_DEADZONE);
  const yAxis = applyDeadzone(leftStick.y, XR_STICK_DEADZONE);

  if (xAxis === 0 && yAxis === 0) {
    return;
  }

  const forward = getVector("forward");
  const right = getVector("right");
  const move = getVector("move").set(0, 0, 0);

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  move.addScaledVector(right, xAxis);
  move.addScaledVector(forward, -yAxis);

  if (move.lengthSq() === 0) {
    return;
  }

  move.normalize().multiplyScalar(XR_MOVE_SPEED * delta);

  const current: Vec3 = [origin.position.x, origin.position.y, origin.position.z];
  const requested: Vec3 = [current[0] + move.x, current[1], current[2] + move.z];
  const resolved = resolvePlayerPosition(current, requested, navigation);
  origin.position.set(...resolved);
}

function readXRThumbstick(
  inputSourceStates: ReturnType<ReturnType<typeof useXRStore>["getState"]>["inputSourceStates"],
  handedness: XRHandedness
): { x: number; y: number } | null {
  const controller = inputSourceStates.find(
    (state) => state.type === "controller" && state.inputSource.handedness === handedness
  );

  if (!controller || controller.type !== "controller") {
    return null;
  }

  const thumbstick = controller.gamepad["xr-standard-thumbstick"];
  if (thumbstick?.xAxis !== undefined || thumbstick?.yAxis !== undefined) {
    return {
      x: thumbstick.xAxis ?? 0,
      y: thumbstick.yAxis ?? 0
    };
  }

  const axes = controller.inputSource.gamepad?.axes;
  if (!axes || axes.length < 2) {
    return null;
  }

  const x = axes[2] ?? axes[0] ?? 0;
  const y = axes[3] ?? axes[1] ?? 0;
  return { x, y };
}

function applyDeadzone(value: number, deadzone: number): number {
  return Math.abs(value) > deadzone ? value : 0;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function updateDesktopMovement(
  origin: Group | null,
  camera: Camera,
  keys: Set<string>,
  delta: number,
  navigation: (typeof layoutNavigation)[LayoutType]
) {
  if (!origin) {
    return;
  }

  const forward = getVector("forward");
  const right = getVector("right");
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  const move = getVector("move").set(0, 0, 0);
  if (keys.has("KeyW")) move.add(forward);
  if (keys.has("KeyS")) move.addScaledVector(forward, -1);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.addScaledVector(right, -1);

  if (move.lengthSq() === 0) {
    return;
  }

  move.normalize().multiplyScalar(DESKTOP_MOVE_SPEED * delta);

  const current: Vec3 = [origin.position.x, origin.position.y, origin.position.z];
  const requested: Vec3 = [current[0] + move.x, current[1], current[2] + move.z];
  const resolved = resolvePlayerPosition(current, requested, navigation);
  origin.position.set(...resolved);
}

const vectorCache = {
  forward: new Vector3(),
  right: new Vector3(),
  move: new Vector3()
};

function getVector(key: keyof typeof vectorCache) {
  return vectorCache[key];
}

function findWorldTarget(raycaster: Raycaster, scene: Object3D): WorldTarget | null {
  const hits = raycaster.intersectObjects(scene.children, true);

  for (const hit of hits) {
    const target = findTargetOnObject(hit.object);
    if (target) {
      return target;
    }
  }

  return null;
}

function findTargetOnObject(object: Object3D): WorldTarget | null {
  let current: Object3D | null = object;

  while (current) {
    const target = (current as TargetedObject).userData.worldTarget;
    if (target) {
      return target;
    }

    current = current.parent;
  }

  return null;
}

function readTargetFromKey(key: string | null): WorldTarget | null {
  if (!key) {
    return null;
  }

  if (key === "portal") {
    return { type: "portal" };
  }

  if (key.startsWith("object:")) {
    return { type: "object", id: key.slice("object:".length) };
  }

  return null;
}
