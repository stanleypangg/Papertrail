"use client";

import { PerspectiveCamera, PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR, useXRControllerLocomotion, XROrigin } from "@react-three/xr";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
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

export function PlayerRig({
  layoutType,
  sceneId,
  pointerLockSelector,
  onPointerLockChange,
  onTargetChange,
  onActivateTarget
}: PlayerRigProps) {
  const { camera, gl, scene } = useThree();
  const xrActive = useXR((state) => state.mode !== null);
  const navigation = layoutNavigation[layoutType];
  const originRef = useRef<Group | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);
  const keys = useRef(new Set<string>());
  const desired = useRef(new Vector3());
  const raycaster = useMemo(() => new Raycaster(), []);
  const lastTargetKey = useRef<string | null>(null);

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
  }, [clearTarget, navigation.spawn, sceneId]);

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

  useXRControllerLocomotion(
    (velocity, rotationVelocityY, deltaTime) => {
      const origin = originRef.current;
      if (!origin) {
        return;
      }

      origin.rotation.y += rotationVelocityY;

      const horizontalVelocity = desired.current.set(velocity.x, 0, velocity.z);
      if (horizontalVelocity.lengthSq() > XR_MOVE_SPEED * XR_MOVE_SPEED) {
        horizontalVelocity.setLength(XR_MOVE_SPEED);
      }

      const current: Vec3 = [origin.position.x, origin.position.y, origin.position.z];
      const requested: Vec3 = [
        current[0] + horizontalVelocity.x * deltaTime,
        current[1],
        current[2] + horizontalVelocity.z * deltaTime
      ];
      const resolved = resolvePlayerPosition(current, requested, navigation);
      origin.position.set(...resolved);
    },
    { speed: XR_MOVE_SPEED },
    { type: "snap", degrees: XR_SNAP_TURN_DEGREES, deadZone: 0.75 },
    "left"
  );

  useFrame((_, delta) => {
    if (xrActive) {
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
