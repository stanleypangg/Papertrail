"use client";

import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Vector3 } from "three";

type VRHelpHintProps = {
  visible: boolean;
};

const hintPosition = new Vector3();
const cameraPosition = new Vector3();
const cameraDirection = new Vector3();

export function VRHelpHint({ visible }: VRHelpHintProps) {
  const { camera } = useThree();
  const groupRef = useRef<Group | null>(null);

  useFrame(() => {
    if (!groupRef.current || !visible) {
      return;
    }

    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);
    hintPosition.copy(cameraPosition).addScaledVector(cameraDirection, 1.55);
    hintPosition.y -= 0.68;

    groupRef.current.position.copy(hintPosition);
    groupRef.current.quaternion.copy(camera.quaternion);
  });

  if (!visible) {
    return null;
  }

  return (
    <group ref={groupRef} renderOrder={999}>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[1.42, 0.18]} />
        <meshBasicMaterial color="#071018" transparent opacity={0.72} depthTest={false} />
      </mesh>
      <Text position={[0, 0, 0]} fontSize={0.045} maxWidth={1.26} textAlign="center" color="#d8fbff">
        Left stick move · Right stick turn · Point/select objects
      </Text>
    </group>
  );
}
