"use client";

import { Text } from "@react-three/drei";

import type { MoodStyle } from "@/lib/sceneMapping";

type LayoutProps = {
  style: MoodStyle;
  dressing: string;
};

export function CorridorPathLayout({ style, dressing }: LayoutProps) {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4.4]}>
        <planeGeometry args={[4.6, 13]} />
        <meshStandardMaterial color={style.floor} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[-2.45, 1.7, -4.4]}>
        <boxGeometry args={[0.16, 3.4, 13]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[2.45, 1.7, -4.4]}>
        <boxGeometry args={[0.16, 3.4, 13]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      {[-1.7, -3.8, -5.9, -8].map((z, index) => (
        <group key={z}>
          <mesh castShadow position={[-1.85, 1.25, z]}>
            <cylinderGeometry args={[0.04, 0.06, 1.7, 10]} />
            <meshStandardMaterial color="#202832" />
          </mesh>
          <pointLight position={[-1.85, 2.25, z]} intensity={0.55} color={index % 2 === 0 ? style.accent : style.key} distance={4} />
          <mesh position={[-1.85, 2.25, z]}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={1.4} />
          </mesh>
        </group>
      ))}
      <Text position={[0, 2.65, -8.75]} fontSize={0.15} maxWidth={3.8} textAlign="center" color="#d7f7ff">
        {dressing}
      </Text>
    </group>
  );
}

