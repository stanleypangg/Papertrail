"use client";

import { Html, useTexture } from "@react-three/drei";
import { useState } from "react";

import type { ScriptCharacter } from "@/lib/sleuth/scripts.types";

interface NpcSpriteProps {
  npc: ScriptCharacter;
  active: boolean;
  onSelect: (npcId: string) => void;
}

export function NpcSprite({ npc, active, onSelect }: NpcSpriteProps) {
  const texture = useTexture(npc.portrait);
  const [hovered, setHovered] = useState(false);
  const highlighted = hovered || active;

  return (
    <group position={npc.scenePosition}>
      <mesh position={[0, 0, -0.04]} scale={[0.82, 1.18, 0.01]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#a8331a"
          transparent
          opacity={highlighted ? 0.34 : 0.14}
        />
      </mesh>

      <sprite
        scale={[0.72, 0.96, 1]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(npc.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
      >
        <spriteMaterial map={texture} transparent />
      </sprite>

      <Html
        position={[0, 0.82, 0]}
        center
        distanceFactor={10}
        pointerEvents="none"
      >
        <div
          className={`border border-white/12 bg-[#110d0c]/92 px-3 py-2 text-center text-[#f3e7d3] transition-opacity duration-200 ${
            highlighted ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-[0.64rem] uppercase tracking-[0.3em] text-[#b88f6b]">
            Suspect
          </div>
          <div className="mt-1 text-sm leading-tight">{npc.name}</div>
        </div>
      </Html>

      <Html
        position={[0, -0.9, 0]}
        center
        distanceFactor={12}
        transform={false}
      >
        <button
          type="button"
          onFocus={() => onSelect(npc.id)}
          onClick={() => onSelect(npc.id)}
          className="pointer-events-auto border border-white/12 bg-[#0d0908]/90 px-2 py-1 text-[0.62rem] uppercase tracking-[0.26em] text-[#f3e7d3] opacity-0 outline-none transition focus:opacity-100 focus:ring-2 focus:ring-[#a8331a]"
          aria-label={`Question ${npc.name}`}
        >
          {npc.name}
        </button>
      </Html>
    </group>
  );
}
