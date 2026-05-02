"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";

import type { ObjectPlacement } from "@/lib/sceneMapping";
import type { WorldTarget } from "@/lib/sceneNavigation";
import type { ScenePlan } from "@/lib/sceneSchema";

type PortalProps = {
  scene: ScenePlan;
  accent: string;
  targeted: boolean;
  placement?: ObjectPlacement;
  onClick: () => void;
};

export function Portal({ scene, accent, targeted, placement, onClick }: PortalProps) {
  const groupRef = useRef<Group | null>(null);
  const position = placement?.position ?? getPortalPosition(scene.layoutType);
  const rotation = placement?.rotation;
  const scale = placement?.scale ?? 1;
  const target: WorldTarget = { type: "portal" };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = (rotation?.[1] ?? 0) + Math.sin(state.clock.elapsedTime * 0.45) * 0.035;
  });

  return (
    <group
      ref={groupRef}
      userData={{ worldTarget: target }}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <pointLight color={accent} intensity={targeted ? 2.4 : 1.8} distance={5} />
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[1.8, 2.7, 0.44]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[1.45, 2.3, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={targeted ? 1.35 : 0.95} transparent opacity={targeted ? 0.34 : 0.22} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <torusGeometry args={[0.92, 0.035, 10, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={targeted ? 2.4 : 1.8} />
      </mesh>
      <Text position={[0, 2.62, 0]} fontSize={0.16} maxWidth={2.4} textAlign="center" color="#f8fbff">
        {scene.transitionToNext.label}
      </Text>
      <Text position={[0, -0.12, 0]} fontSize={0.1} maxWidth={2.4} textAlign="center" color="#cdefff">
        {scene.transitionToNext.description}
      </Text>
    </group>
  );
}

function getPortalPosition(layoutType: ScenePlan["layoutType"]): [number, number, number] {
  if (layoutType === "corridor_path") {
    return [0, 0, -10.25];
  }

  if (layoutType === "open_clearing") {
    return [0, 0, -5.5];
  }

  if (layoutType === "exhibit_space") {
    return [0, 0, -5.0];
  }

  return [2.65, 0, -3.7];
}
