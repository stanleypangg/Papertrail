"use client";

import { Text } from "@react-three/drei";

import type { MoodStyle } from "@/lib/sceneMapping";

type LayoutProps = {
  style: MoodStyle;
  dressing: string;
};

export function InteriorRoomLayout({ style, dressing }: LayoutProps) {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.1]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color={style.floor} roughness={0.92} />
      </mesh>
      <mesh receiveShadow position={[0, 2, -4]}>
        <boxGeometry args={[8, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[-4, 2, -1.1]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[6, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[4, 2, -1.1]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[6, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.72, -0.9]}>
        <boxGeometry args={[2.4, 0.22, 1.25]} />
        <meshStandardMaterial color="#564232" roughness={0.72} />
      </mesh>
      <mesh castShadow position={[-0.95, 0.35, -0.45]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#33261e" />
      </mesh>
      <mesh castShadow position={[0.95, 0.35, -0.45]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#33261e" />
      </mesh>
      <mesh castShadow position={[-0.95, 0.35, -1.35]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#33261e" />
      </mesh>
      <mesh castShadow position={[0.95, 0.35, -1.35]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#33261e" />
      </mesh>
      <Text
        position={[0, 2.95, -3.88]}
        fontSize={0.16}
        maxWidth={5.8}
        textAlign="center"
        color="#d7f7ff"
        anchorX="center"
        anchorY="middle"
      >
        {dressing}
      </Text>
    </group>
  );
}

