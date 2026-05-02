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
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -5.6]}>
        <planeGeometry args={[11.5, 14]} />
        <meshStandardMaterial color={style.floor} roughness={0.86} metalness={0.08} />
      </mesh>
      <mesh receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 4.05, -5.6]}>
        <planeGeometry args={[11.5, 14]} />
        <meshStandardMaterial color="#171d24" roughness={0.76} metalness={0.06} />
      </mesh>
      <mesh receiveShadow position={[-5.75, 2, -5.6]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[14, 4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[5.75, 2, -5.6]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[14, 4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[-4.2, 2, 1.38]}>
        <boxGeometry args={[3.1, 4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[4.2, 2, 1.38]}>
        <boxGeometry args={[3.1, 4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[0, 3.5, 1.38]}>
        <boxGeometry args={[5.3, 1, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[-4.35, 2, -12.02]}>
        <boxGeometry args={[2.8, 4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[4.35, 2, -12.02]}>
        <boxGeometry args={[2.8, 4, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[0, 3.35, -12.02]}>
        <boxGeometry args={[5.9, 1.3, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      <mesh receiveShadow position={[0, 0.32, -12.02]}>
        <boxGeometry args={[5.9, 0.64, 0.16]} />
        <meshStandardMaterial color={style.wall} roughness={0.72} />
      </mesh>
      {[
        [-3.2, -2.6],
        [0, -4.2],
        [3.2, -5.8]
      ].map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
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
      {[-3.8, 0, 3.8].map((x, index) => (
        <group key={`ceiling-light-${x}`} position={[x, 3.82, -2.2 - index * 2.1]}>
          <mesh>
            <boxGeometry args={[1.05, 0.08, 0.24]} />
            <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.75} />
          </mesh>
          <pointLight color={style.accent} intensity={0.35} distance={4.8} />
        </group>
      ))}
      {[-5.35, 5.35].map((x) =>
        [-1.2, -4.1, -7, -9.4].map((z) => (
          <mesh key={`partition-${x}:${z}`} castShadow receiveShadow position={[x * 0.72, 1.55, z]}>
            <boxGeometry args={[0.24, 3.1, 1.25]} />
            <meshStandardMaterial color="#1e2630" roughness={0.74} />
          </mesh>
        ))
      )}
      <mesh position={[0, 1.85, -11.9]}>
        <boxGeometry args={[8.4, 0.05, 0.05]} />
        <meshStandardMaterial color={style.accent} emissive={style.accent} emissiveIntensity={0.7} />
      </mesh>
      <Text position={[0, 2.55, -11.84]} fontSize={0.16} maxWidth={8.2} textAlign="center" color="#d7f7ff">
        {dressing}
      </Text>
    </group>
  );
}
