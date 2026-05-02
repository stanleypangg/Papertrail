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
        <circleGeometry args={[11.2, 96]} />
        <meshStandardMaterial color={style.floor} roughness={0.95} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, -1.5]}>
        <ringGeometry args={[8.75, 11.65, 112]} />
        <meshStandardMaterial color={style.wall} roughness={0.98} transparent opacity={0.58} />
      </mesh>
      {Array.from({ length: 22 }, (_, index) => {
        const angle = (index / 22) * Math.PI * 2 + 0.08;
        const radius = 8.35 + (index % 2) * 0.32;

        return (
          <mesh key={`stone-${index}`} castShadow receiveShadow position={[Math.cos(angle) * radius, 0.18, -1.5 + Math.sin(angle) * radius]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[0.85, 0.36, 0.42]} />
            <meshStandardMaterial color={index % 2 === 0 ? style.wall : style.floor} roughness={0.96} />
          </mesh>
        );
      })}
      {Array.from({ length: 26 }, (_, index) => {
        const angle = (index / 26) * Math.PI * 2;
        const radius = 8.65 + (index % 4) * 0.5;
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
            <mesh castShadow position={[0.25, 2.52, -0.12]}>
              <coneGeometry args={[0.34, 0.86, 8]} />
              <meshStandardMaterial color={index % 3 === 0 ? "#25483d" : "#1f3431"} roughness={0.82} />
            </mesh>
          </group>
        );
      })}
      {[-5.2, 5.2].map((x) => (
        <mesh key={x} position={[x, 0.72, -10.42]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 1.44, 0.18]} />
          <meshStandardMaterial color={style.wall} roughness={0.9} />
        </mesh>
      ))}
      <Text position={[0, 2.4, -10.3]} fontSize={0.16} maxWidth={8} textAlign="center" color="#d7f7ff">
        {dressing}
      </Text>
      {[-3.2, 0, 3.2].map((x, index) => (
        <mesh key={`path-marker-${x}`} castShadow receiveShadow position={[x, 0.08, 2.55 - index * 1.35]} rotation={[0, 0.35 * (index - 1), 0]}>
          <boxGeometry args={[1.2, 0.16, 0.54]} />
          <meshStandardMaterial color="#2c2b24" roughness={0.98} />
        </mesh>
      ))}
    </group>
  );
}
