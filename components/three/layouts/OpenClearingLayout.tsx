"use client";

import { Text } from "@react-three/drei";

import type { MoodStyle } from "@/lib/sceneMapping";

type LayoutProps = {
  style: MoodStyle;
  dressing: string;
};

export function OpenClearingLayout({ style, dressing }: LayoutProps) {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.5]}>
        <circleGeometry args={[6.8, 64]} />
        <meshStandardMaterial color={style.floor} roughness={0.95} />
      </mesh>
      {Array.from({ length: 14 }, (_, index) => {
        const angle = (index / 14) * Math.PI * 2;
        const radius = 5.1 + (index % 3) * 0.4;
        const x = Math.cos(angle) * radius;
        const z = -1.5 + Math.sin(angle) * radius;

        return (
          <group key={index} position={[x, 0, z]}>
            <mesh castShadow position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.08, 0.14, 1.8, 8]} />
              <meshStandardMaterial color="#2a211c" roughness={0.9} />
            </mesh>
            <mesh castShadow position={[0, 2.05, 0]}>
              <coneGeometry args={[0.48, 1.2, 8]} />
              <meshStandardMaterial color={index % 2 === 0 ? "#203b35" : "#2c3440"} roughness={0.8} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 1.05, -5.8]}>
        <boxGeometry args={[8, 2.1, 0.12]} />
        <meshStandardMaterial color={style.wall} transparent opacity={0.36} />
      </mesh>
      <Text position={[0, 2.4, -5.7]} fontSize={0.16} maxWidth={6} textAlign="center" color="#d7f7ff">
        {dressing}
      </Text>
    </group>
  );
}

