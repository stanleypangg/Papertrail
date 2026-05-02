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
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10.3]}>
        <planeGeometry args={[5.2, 24.6]} />
        <meshStandardMaterial color={style.floor} roughness={0.9} />
      </mesh>
      <mesh receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 3.42, -10.3]}>
        <planeGeometry args={[5.2, 24.6]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[-2.75, 1.7, -10.3]}>
        <boxGeometry args={[0.16, 3.4, 24.6]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[2.75, 1.7, -10.3]}>
        <boxGeometry args={[0.16, 3.4, 24.6]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[0, 1.7, 1.92]}>
        <boxGeometry args={[5.2, 3.4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[-1.62, 1.7, -22.18]}>
        <boxGeometry args={[1.65, 3.4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[1.62, 1.7, -22.18]}>
        <boxGeometry args={[1.65, 3.4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[0, 3.02, -22.18]}>
        <boxGeometry args={[2.2, 0.8, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.88} />
      </mesh>
      {[-2.35, 2.35].map((x) =>
        [-3.2, -7.6, -12, -16.4, -19.2].map((z) => (
          <group key={`alcove-${x}:${z}`} position={[x, 0, z]}>
            <mesh castShadow receiveShadow position={[0, 1.15, 0]}>
              <boxGeometry args={[0.52, 2.3, 1.25]} />
              <meshStandardMaterial color="#111821" roughness={0.92} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, 2.45, 0]}>
              <boxGeometry args={[0.7, 0.18, 1.35]} />
              <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.32} />
            </mesh>
          </group>
        ))
      )}
      {[-1.7, -3.8, -5.9, -8, -10.2, -12.4, -14.6, -16.8, -19].map((z, index) => (
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
      <Text position={[0, 2.65, -20.35]} fontSize={0.15} maxWidth={4.5} textAlign="center" color="#d7f7ff">
        {dressing}
      </Text>
    </group>
  );
}
