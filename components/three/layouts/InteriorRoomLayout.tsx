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
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -3.9]}>
        <planeGeometry args={[12, 17]} />
        <meshStandardMaterial color={style.floor} roughness={0.92} />
      </mesh>
      <mesh receiveShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 4.05, -3.9]}>
        <planeGeometry args={[12, 17]} />
        <meshStandardMaterial color={style.wall} roughness={0.94} />
      </mesh>
      <mesh receiveShadow position={[-4.55, 2, 4.55]}>
        <boxGeometry args={[2.9, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[4.55, 2, 4.55]}>
        <boxGeometry args={[2.9, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[0, 3.45, 4.55]}>
        <boxGeometry args={[6.3, 1.1, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[-4.55, 2, -12.3]}>
        <boxGeometry args={[2.9, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[4.55, 2, -12.3]}>
        <boxGeometry args={[2.9, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[0, 3.42, -12.3]}>
        <boxGeometry args={[6.3, 1.16, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[0, 0.32, -12.3]}>
        <boxGeometry args={[6.3, 0.64, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[-6, 2, -3.9]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[17, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[6, 2, -3.9]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[17, 4, 0.18]} />
        <meshStandardMaterial color={style.wall} roughness={0.9} />
      </mesh>
      {[-4.15, 0, 4.15].map((x) => (
        <mesh key={`beam-${x}`} castShadow receiveShadow position={[x, 3.86, -3.9]}>
          <boxGeometry args={[0.2, 0.22, 16.2]} />
          <meshStandardMaterial color="#241c17" roughness={0.78} />
        </mesh>
      ))}
      {[-5.35, 5.35].map((x) =>
        [-9.6, -6.7, -2.4, 1.9].map((z) => (
          <mesh key={`column-${x}:${z}`} castShadow receiveShadow position={[x, 1.88, z]}>
            <boxGeometry args={[0.32, 3.75, 0.32]} />
            <meshStandardMaterial color="#2d231c" roughness={0.82} />
          </mesh>
        ))
      )}
      {[-5.88, 5.88].map((x) => (
        <group key={`shelves-${x}`} position={[x, 1.25, -4.9]} rotation={[0, Math.PI / 2, 0]}>
          {[-1.6, 0, 1.6].map((z, index) => (
            <mesh key={z} castShadow receiveShadow position={[0, 0.16 * index, z]}>
              <boxGeometry args={[0.18, 0.16, 1.15]} />
              <meshStandardMaterial color={index % 2 === 0 ? "#5b4534" : style.wall} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
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
      <mesh receiveShadow position={[0, 0.04, -10.35]}>
        <boxGeometry args={[5.8, 0.08, 2.6]} />
        <meshStandardMaterial color="#1d1713" roughness={0.94} />
      </mesh>
      <Text
        position={[0, 2.95, -12.18]}
        fontSize={0.16}
        maxWidth={8.8}
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
