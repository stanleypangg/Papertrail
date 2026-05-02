"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";

import { layoutSpecs } from "@/lib/layoutSpecs";
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
  const [hovered, setHovered] = useState(false);
  const portalPlacement: ObjectPlacement = placement ?? layoutSpecs[scene.layoutType].portal;
  const position = portalPlacement.position;
  const rotation = portalPlacement.rotation;
  const scale = portalPlacement.scale ?? 1;
  const target: WorldTarget = { type: "portal" };
  const highlighted = targeted || hovered;

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
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <pointLight color={accent} intensity={highlighted ? 2.4 : 1.8} distance={5} />
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[1.8, 2.7, 0.44]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[1.45, 2.3, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={highlighted ? 1.35 : 0.95} transparent opacity={highlighted ? 0.34 : 0.22} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <torusGeometry args={[0.92, 0.035, 10, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={highlighted ? 2.4 : 1.8} />
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
