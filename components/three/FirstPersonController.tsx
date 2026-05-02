"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Camera, Vector3 } from "three";

const EYE_HEIGHT = 1.7;
const MOVE_SPEED = 4.2;

type MovementKeys = {
  backward: boolean;
  forward: boolean;
  left: boolean;
  right: boolean;
};

const keyMap: Record<string, keyof MovementKeys> = {
  KeyA: "left",
  KeyD: "right",
  KeyS: "backward",
  KeyW: "forward",
};

export function FirstPersonController() {
  const { camera } = useThree();
  const keys = useRef<MovementKeys>({
    backward: false,
    forward: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    function setKey(event: KeyboardEvent, pressed: boolean) {
      const key = keyMap[event.code];

      if (!key) {
        return;
      }

      keys.current[key] = pressed;
      event.preventDefault();
    }

    function handleKeyDown(event: KeyboardEvent) {
      setKey(event, true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      setKey(event, false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => updateCameraPosition(camera, keys.current, delta));

  return <PointerLockControls selector=".canvas-crosshair" />;
}

const vectorCache = {
  forward: new Vector3(),
  movement: new Vector3(),
  right: new Vector3(),
};

function updateCameraPosition(camera: Camera, keys: MovementKeys, delta: number) {
  const forwardAmount = Number(keys.forward) - Number(keys.backward);
  const rightAmount = Number(keys.right) - Number(keys.left);

  if (forwardAmount === 0 && rightAmount === 0) {
    return;
  }

  const { forward, movement, right } = vectorCache;
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  movement
    .copy(forward)
    .multiplyScalar(forwardAmount)
    .addScaledVector(right, rightAmount)
    .normalize()
    .multiplyScalar(MOVE_SPEED * delta);

  camera.position.add(movement);
  camera.position.y = EYE_HEIGHT;
}
