"use client";

import { Text } from "@react-three/drei";

import type { MoodStyle } from "@/lib/sceneMapping";

type LayoutProps = {
  style: MoodStyle;
  dressing: string;
};

export function ExhibitSpaceLayout({ style, dressing }: LayoutProps) {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2.3]}>
        <planeGeometry args={[8.5, 7]} />
        <meshStandardMaterial color={style.floor} roughness={0.86} metalness={0.08} />
      </mesh>
      <mesh receiveShadow position={[0, 2, -5.05]}>
        <boxGeometry args={[8.5, 4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      {[-2.6, 0, 2.6].map((x) => (
        <group key={x} position={[x, 0, -2.5]}>
          <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
            <cylinderGeometry args={[0.48, 0.58, 0.96, 24]} />
            <meshStandardMaterial color="#242b33" roughness={0.62} />
          </mesh>
          <mesh position={[0, 1.03, 0]}>
            <cylinderGeometry args={[0.52, 0.52, 0.08, 24]} />
            <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.45} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.85, -4.94]}>
        <boxGeometry args={[6.4, 0.05, 0.05]} />
        <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.7} />
      </mesh>
      <Text position={[0, 2.55, -4.88]} fontSize={0.16} maxWidth={6} textAlign="center" color="#d7f7ff">
        {dressing}
      </Text>
    </group>
  );
}

