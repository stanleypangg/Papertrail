"use client";

import { PerspectiveCamera, PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR, useXRInputSourceState, XROrigin } from "@react-three/xr";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  Group,
  MathUtils,
  Object3D,
  Quaternion,
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
const XR_TURN_DEADZONE = 0.75;
const XR_THUMBSTICK = "xr-standard-thumbstick";

export function PlayerRig({
  layoutType,
  sceneId,
  resetSignal = 0,
  pointerLockSelector,
  onPointerLockChange,
  onTargetChange,
  onActivateTarget
}: PlayerRigProps) {
  const { camera, gl, scene } = useThree();
  const xrActive = useXR((state) => state.mode !== null);
  const leftController = useXRInputSourceState("controller", "left");
  const rightController = useXRInputSourceState("controller", "right");
  const navigation = layoutNavigation[layoutType];
  const originRef = useRef<Group | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);
  const keys = useRef(new Set<string>());
  const desired = useRef(new Vector3());
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

    if (playerCamera) {
      playerCamera.position.set(0, PLAYER_HEIGHT, 0);
      playerCamera.rotation.set(0, 0, 0);
    }
  }, [clearTarget, navigation.spawn, resetSignal, sceneId]);

  useEffect(() => {
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
  }, [onActivateTarget]);

  useFrame((_, delta) => {
    if (xrActive) {
      updateXRMovement(
        originRef.current,
        camera,
        leftController,
        rightController,
        desired.current,
        canSnapTurn,
        delta,
        navigation
      );
      clearTarget();
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
    <XROrigin ref={originRef}>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, PLAYER_HEIGHT, 0]} fov={68} />
      <PointerLockControls
        selector={pointerLockSelector}
        enabled={!xrActive}
        onLock={() => onPointerLockChange(true)}
        onUnlock={() => {
          keys.current.clear();
          clearTarget();
          onPointerLockChange(false);
        }}
        makeDefault
      />
    </XROrigin>
  );
}

function updateXRMovement(
  origin: Group | null,
  camera: Camera,
  leftController: ReturnType<typeof useXRInputSourceState<"controller">>,
  rightController: ReturnType<typeof useXRInputSourceState<"controller">>,
  velocity: Vector3,
  canSnapTurn: MutableRefObject<boolean>,
  delta: number,
  navigation: (typeof layoutNavigation)[LayoutType]
) {
  if (!origin) {
    return;
  }

  const movementController = leftController ?? rightController;
  const movementStick = movementController?.gamepad[XR_THUMBSTICK];

  if (movementStick) {
    const xAxis = applyDeadzone(movementStick.xAxis ?? 0, 0.12);
    const yAxis = applyDeadzone(movementStick.yAxis ?? 0, 0.12);

    if (xAxis !== 0 || yAxis !== 0) {
      velocity.set(xAxis * XR_MOVE_SPEED, 0, yAxis * XR_MOVE_SPEED);
      camera.getWorldQuaternion(getQuaternion("camera"));
      velocity.applyQuaternion(getQuaternion("camera"));
      velocity.y = 0;

      if (velocity.lengthSq() > XR_MOVE_SPEED * XR_MOVE_SPEED) {
        velocity.setLength(XR_MOVE_SPEED);
      }

      const current: Vec3 = [origin.position.x, origin.position.y, origin.position.z];
      const requested: Vec3 = [
        current[0] + velocity.x * delta,
        current[1],
        current[2] + velocity.z * delta
      ];
      const resolved = resolvePlayerPosition(current, requested, navigation);
      origin.position.set(...resolved);
    }
  }

  if (!leftController || !rightController) {
    canSnapTurn.current = true;
    return;
  }

  const turnAxis = rightController.gamepad[XR_THUMBSTICK]?.xAxis ?? 0;
  if (Math.abs(turnAxis) < XR_TURN_DEADZONE) {
    canSnapTurn.current = true;
    return;
  }

  if (!canSnapTurn.current) {
    return;
  }

  canSnapTurn.current = false;
  origin.rotation.y += (turnAxis > 0 ? -1 : 1) * MathUtils.degToRad(XR_SNAP_TURN_DEGREES);
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

const quaternionCache = {
  camera: new Quaternion()
};

function getVector(key: keyof typeof vectorCache) {
  return vectorCache[key];
}

function getQuaternion(key: keyof typeof quaternionCache) {
  return quaternionCache[key];
}

function applyDeadzone(value: number, deadzone: number): number {
  return Math.abs(value) > deadzone ? value : 0;
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
