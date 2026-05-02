"use client";

import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Vector3 } from "three";

import type { SceneObject } from "@/lib/sceneSchema";

type VRInfoPanelProps = {
  object: SceneObject | null;
  visible: boolean;
};

const panelPosition = new Vector3();
const cameraPosition = new Vector3();
const cameraDirection = new Vector3();

export function VRInfoPanel({ object, visible }: VRInfoPanelProps) {
  const { camera } = useThree();
  const groupRef = useRef<Group | null>(null);

  useFrame(() => {
    if (!groupRef.current || !visible || !object) {
      return;
    }

    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);
    panelPosition.copy(cameraPosition).addScaledVector(cameraDirection, 1.35);
    panelPosition.y -= 0.2;

    groupRef.current.position.copy(panelPosition);
    groupRef.current.quaternion.copy(camera.quaternion);
  });

  if (!visible || !object) {
    return null;
  }

  return (
    <group ref={groupRef} renderOrder={1000}>
      <mesh position={[0, 0, -0.025]}>
        <planeGeometry args={[1.35, 0.84]} />
        <meshBasicMaterial color="#071018" transparent opacity={0.86} depthTest={false} />
      </mesh>
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[1.42, 0.91]} />
        <meshBasicMaterial color="#7df4ff" transparent opacity={0.18} depthTest={false} />
      </mesh>
      <Text position={[-0.58, 0.31, 0]} fontSize={0.055} maxWidth={1.14} anchorX="left" color="#bff8ff">
        Source object
      </Text>
      <Text position={[-0.58, 0.21, 0]} fontSize={0.085} maxWidth={1.14} anchorX="left" color="#ffffff">
        {limitText(object.label, 34)}
      </Text>
      <Text position={[-0.58, 0.08, 0]} fontSize={0.045} maxWidth={1.14} anchorX="left" color="#d7dee8">
        {limitText(object.description, 130)}
      </Text>
      <Text position={[-0.58, -0.13, 0]} fontSize={0.042} maxWidth={1.14} anchorX="left" color="#e9fdff">
        {`"${limitText(object.quote, 150)}"`}
      </Text>
      <Text position={[-0.58, -0.33, 0]} fontSize={0.04} maxWidth={1.14} anchorX="left" color="#c8d2dc">
        {limitText(object.explanation, 150)}
      </Text>
    </group>
  );
}

function limitText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}
