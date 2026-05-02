import { layoutSpecs, type LayoutObjectPlacement } from "./layoutSpecs";
import type { LayoutType, Mood, SceneObject } from "./sceneSchema";

export type Vec3 = [number, number, number];

export type ObjectPlacement = LayoutObjectPlacement;

export type MoodStyle = {
  background: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  ambient: string;
  ambientIntensity: number;
  key: string;
  accent: string;
  floor: string;
  wall: string;
};

export const moodStyles: Record<Mood, MoodStyle> = {
  warm: {
    background: "#211a14",
    fog: "#3b2a1e",
    fogNear: 14,
    fogFar: 42,
    ambient: "#f7c58d",
    ambientIntensity: 0.75,
    key: "#ffc27a",
    accent: "#ffb35c",
    floor: "#31251b",
    wall: "#463224"
  },
  mysterious: {
    background: "#090c13",
    fog: "#101725",
    fogNear: 8,
    fogFar: 32,
    ambient: "#8aa7ff",
    ambientIntensity: 0.35,
    key: "#83b5ff",
    accent: "#79f2ff",
    floor: "#111827",
    wall: "#182235"
  },
  tense: {
    background: "#0d0808",
    fog: "#1d1010",
    fogNear: 10,
    fogFar: 28,
    ambient: "#ff9b7a",
    ambientIntensity: 0.28,
    key: "#ff5b4f",
    accent: "#ff3d4d",
    floor: "#18100f",
    wall: "#2a1715"
  },
  melancholic: {
    background: "#101216",
    fog: "#1c222b",
    fogNear: 9,
    fogFar: 38,
    ambient: "#a9b8c8",
    ambientIntensity: 0.48,
    key: "#8fa6c5",
    accent: "#9ad0ff",
    floor: "#171b20",
    wall: "#242b33"
  },
  wonder: {
    background: "#07131c",
    fog: "#0c2534",
    fogNear: 12,
    fogFar: 48,
    ambient: "#b8ffe8",
    ambientIntensity: 0.65,
    key: "#9efcff",
    accent: "#7cffb2",
    floor: "#10232a",
    wall: "#16323b"
  },
  neutral: {
    background: "#111318",
    fog: "#1a1e25",
    fogNear: 15,
    fogFar: 46,
    ambient: "#d9e4ef",
    ambientIntensity: 0.55,
    key: "#dde8f0",
    accent: "#a7c7ff",
    floor: "#20242b",
    wall: "#2d333c"
  }
};

export function getPlacement(layoutType: LayoutType, object: SceneObject, index: number): ObjectPlacement {
  const fallbackSlots: SceneObject["slot"][] = ["left", "center", "right"];
  const slot = object.slot === "floor" ? fallbackSlots[index] ?? "center" : object.slot;

  const placements = layoutSpecs[layoutType].objects;

  return placements[slot] ?? placements[fallbackSlots[index] ?? "center"];
}
