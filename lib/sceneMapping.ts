import type { LayoutType, Mood, SceneObject } from "./sceneSchema";

export type Vec3 = [number, number, number];

export type ObjectPlacement = {
  position: Vec3;
  rotation?: Vec3;
  scale?: number;
};

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

  const maps: Record<LayoutType, Record<SceneObject["slot"], ObjectPlacement>> = {
    interior_room: {
      center: { position: [0, 1.05, -1.2], scale: 1.1 },
      left: { position: [-2.8, 0.75, -1.2], rotation: [0, 0.35, 0] },
      right: { position: [2.8, 0.75, -1.2], rotation: [0, -0.35, 0] },
      back: { position: [0, 1.2, -3.25] },
      table: { position: [0, 1.45, -0.9], scale: 0.85 },
      floor: { position: [0, 0.55, -0.5] },
      wall: { position: [0, 1.9, -3.65], rotation: [0, 0, 0], scale: 1.1 }
    },
    open_clearing: {
      center: { position: [0, 1, -1.2], scale: 1.2 },
      left: { position: [-3.2, 0.9, -1.7] },
      right: { position: [3.2, 0.9, -1.7] },
      back: { position: [0, 1, -4.1] },
      table: { position: [0, 1.1, -1.2] },
      floor: { position: [0, 0.55, -1.2] },
      wall: { position: [0, 1.4, -4.2] }
    },
    corridor_path: {
      center: { position: [0, 0.95, -5] },
      left: { position: [-2.15, 0.95, -3.2], rotation: [0, 0.25, 0] },
      right: { position: [2.15, 0.95, -6.2], rotation: [0, -0.25, 0] },
      back: { position: [0, 1.35, -8.8] },
      table: { position: [-1.8, 1.2, -3.8] },
      floor: { position: [0, 0.5, -5.2] },
      wall: { position: [2.35, 1.7, -4.7], rotation: [0, -Math.PI / 2, 0] }
    },
    exhibit_space: {
      center: { position: [0, 1.3, -2.5], scale: 1.1 },
      left: { position: [-2.6, 1.25, -2.2] },
      right: { position: [2.6, 1.25, -2.2] },
      back: { position: [0, 1.35, -4.5] },
      table: { position: [0, 1.35, -2.5] },
      floor: { position: [0, 0.55, -2.6] },
      wall: { position: [0, 2, -4.85], scale: 1.2 }
    }
  };

  return maps[layoutType][slot] ?? maps[layoutType][fallbackSlots[index] ?? "center"];
}

