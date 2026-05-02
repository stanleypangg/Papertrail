import type { LayoutType, SceneObject } from "./sceneSchema";

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type WalkZone =
  | { type: "rect"; minX: number; maxX: number; minZ: number; maxZ: number }
  | { type: "circle"; center: Vec2; radius: number };

export type Blocker =
  | { type: "rect"; minX: number; maxX: number; minZ: number; maxZ: number }
  | { type: "circle"; center: Vec2; radius: number };

export type LayoutObjectPlacement = {
  position: Vec3;
  rotation?: Vec3;
  scale?: number;
};

export type LayoutMuralPlacement = {
  position: Vec3;
  rotation?: Vec3;
  size: Vec2;
};

export type LayoutDepthProfile = {
  mural: LayoutMuralPlacement;
  farZ: number;
  foregroundZ: number;
  midgroundZ: number;
};

export type LayoutSpec = {
  spawn: Vec3;
  walkZone: WalkZone;
  blockers: Blocker[];
  depth: LayoutDepthProfile;
  objects: Record<SceneObject["slot"], LayoutObjectPlacement>;
  portal: LayoutObjectPlacement;
};

export const layoutSpecs = {
  interior_room: {
    spawn: [0, 0, 4.2],
    walkZone: { type: "rect", minX: -5.55, maxX: 5.55, minZ: -11.8, maxZ: 4.8 },
    blockers: [{ type: "rect", minX: -1.35, maxX: 1.35, minZ: -1.6, maxZ: -0.2 }],
    depth: {
      mural: { position: [0, 1.72, -12.25], size: [5.8, 1.9] },
      farZ: -12.4,
      foregroundZ: -3.1,
      midgroundZ: -8.4
    },
    objects: {
      center: { position: [0, 1.05, -3.05], scale: 1.1 },
      left: { position: [-4.25, 0.75, -3.45], rotation: [0, 0.35, 0] },
      right: { position: [4.25, 0.75, -3.45], rotation: [0, -0.35, 0] },
      back: { position: [0, 1.2, -8.6] },
      table: { position: [0, 1.45, -0.9], scale: 0.85 },
      floor: { position: [0, 0.55, -2.15] },
      wall: { position: [0, 1.9, -11.45], rotation: [0, 0, 0], scale: 1.1 }
    },
    portal: { position: [4.25, 0, -10.65], rotation: [0, -0.35, 0] }
  },
  open_clearing: {
    spawn: [0, 0, 3.4],
    walkZone: { type: "circle", center: [0, -1.5], radius: 8.8 },
    blockers: [{ type: "rect", minX: -6.6, maxX: 6.6, minZ: -10.85, maxZ: -10.45 }],
    depth: {
      mural: { position: [0, 1.32, -10.8], size: [5.8, 1.85] },
      farZ: -10.9,
      foregroundZ: -1.6,
      midgroundZ: -7.7
    },
    objects: {
      center: { position: [0, 1, -2.45], scale: 1.2 },
      left: { position: [-4.8, 0.9, -2.75] },
      right: { position: [4.8, 0.9, -2.75] },
      back: { position: [0, 1, -7.7] },
      table: { position: [0, 1.1, -2.1] },
      floor: { position: [0, 0.55, -2.2] },
      wall: { position: [0, 1.4, -9] }
    },
    portal: { position: [0, 0, -10.05] }
  },
  corridor_path: {
    spawn: [0, 0, 1.45],
    walkZone: { type: "rect", minX: -2.15, maxX: 2.15, minZ: -21.8, maxZ: 1.55 },
    blockers: [-1.7, -3.8, -5.9, -8, -10.2, -12.4, -14.6, -16.8, -19].map((z) => ({
      type: "circle",
      center: [-1.85, z],
      radius: 0.22
    })),
    depth: {
      mural: { position: [0, 1.86, -22.05], size: [3.2, 1.55] },
      farZ: -22.1,
      foregroundZ: -4.8,
      midgroundZ: -14.2
    },
    objects: {
      center: { position: [0, 0.95, -7.1] },
      left: { position: [-2.25, 0.95, -4.25], rotation: [0, 0.25, 0] },
      right: { position: [2.25, 0.95, -8.25], rotation: [0, -0.25, 0] },
      back: { position: [0, 1.35, -16.8] },
      table: { position: [-1.8, 1.2, -5.2] },
      floor: { position: [0, 0.5, -7.4] },
      wall: { position: [2.55, 1.7, -10.4], rotation: [0, -Math.PI / 2, 0] }
    },
    portal: { position: [0, 0, -21.05] }
  },
  exhibit_space: {
    spawn: [0, 0, 1.25],
    walkZone: { type: "rect", minX: -5.05, maxX: 5.05, minZ: -11.6, maxZ: 1 },
    blockers: [
      { type: "circle", center: [-3.2, -2.6], radius: 0.72 },
      { type: "circle", center: [0, -4.2], radius: 0.72 },
      { type: "circle", center: [3.2, -5.8], radius: 0.72 }
    ],
    depth: {
      mural: { position: [0, 1.82, -12.05], size: [6, 1.85] },
      farZ: -12.1,
      foregroundZ: -3.5,
      midgroundZ: -8.5
    },
    objects: {
      center: { position: [0, 1.3, -4.2], scale: 1.1 },
      left: { position: [-3.2, 1.25, -2.9] },
      right: { position: [3.2, 1.25, -5.8] },
      back: { position: [0, 1.35, -8.75] },
      table: { position: [0, 1.35, -4.2] },
      floor: { position: [0, 0.55, -4.1] },
      wall: { position: [0, 2, -11.35], scale: 1.2 }
    },
    portal: { position: [0, 0, -10.95] }
  }
} satisfies Record<LayoutType, LayoutSpec>;
