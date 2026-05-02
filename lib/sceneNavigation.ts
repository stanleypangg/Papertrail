import type { LayoutType, SceneObject } from "./sceneSchema";

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type WorldTarget =
  | { type: "object"; id: SceneObject["id"] }
  | { type: "portal" };

export type WalkZone =
  | { type: "rect"; minX: number; maxX: number; minZ: number; maxZ: number }
  | { type: "circle"; center: Vec2; radius: number };

export type Blocker =
  | { type: "rect"; minX: number; maxX: number; minZ: number; maxZ: number }
  | { type: "circle"; center: Vec2; radius: number };

export type LayoutNavigation = {
  spawn: Vec3;
  walkZone: WalkZone;
  blockers: Blocker[];
};

export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.35;
export const DESKTOP_MOVE_SPEED = 4.2;
export const XR_MOVE_SPEED = 2;
export const XR_SNAP_TURN_DEGREES = 30;

export const layoutNavigation: Record<LayoutType, LayoutNavigation> = {
  interior_room: {
    spawn: [0, 0, 3.2],
    walkZone: { type: "rect", minX: -3.35, maxX: 3.35, minZ: -3.2, maxZ: 3.35 },
    blockers: [{ type: "rect", minX: -1.35, maxX: 1.35, minZ: -1.6, maxZ: -0.2 }]
  },
  open_clearing: {
    spawn: [0, 0, 3.4],
    walkZone: { type: "circle", center: [0, -1.5], radius: 4.6 },
    blockers: [{ type: "rect", minX: -4.15, maxX: 4.15, minZ: -6.05, maxZ: -5.55 }]
  },
  corridor_path: {
    spawn: [0, 0, 1.45],
    walkZone: { type: "rect", minX: -1.85, maxX: 1.85, minZ: -10.55, maxZ: 1.55 },
    blockers: [-1.7, -3.8, -5.9, -8].map((z) => ({ type: "circle", center: [-1.85, z], radius: 0.22 }))
  },
  exhibit_space: {
    spawn: [0, 0, 1.05],
    walkZone: { type: "rect", minX: -3.55, maxX: 3.55, minZ: -4.8, maxZ: 0.8 },
    blockers: [-2.6, 0, 2.6].map((x) => ({ type: "circle", center: [x, -2.5], radius: 0.72 }))
  }
};

export function targetKey(target: WorldTarget | null): string | null {
  if (!target) {
    return null;
  }

  return target.type === "portal" ? "portal" : `object:${target.id}`;
}

export function resolvePlayerPosition(
  current: Vec3,
  requested: Vec3,
  navigation: LayoutNavigation,
  radius = PLAYER_RADIUS
): Vec3 {
  const full = clampToWalkZone(requested, navigation.walkZone, radius);

  if (isValidPosition(full, navigation, radius)) {
    return full;
  }

  const xOnly = clampToWalkZone([full[0], current[1], current[2]], navigation.walkZone, radius);
  if (isValidPosition(xOnly, navigation, radius)) {
    return xOnly;
  }

  const zOnly = clampToWalkZone([current[0], current[1], full[2]], navigation.walkZone, radius);
  if (isValidPosition(zOnly, navigation, radius)) {
    return zOnly;
  }

  return current;
}

function clampToWalkZone(position: Vec3, zone: WalkZone, radius: number): Vec3 {
  if (zone.type === "rect") {
    return [
      clamp(position[0], zone.minX + radius, zone.maxX - radius),
      position[1],
      clamp(position[2], zone.minZ + radius, zone.maxZ - radius)
    ];
  }

  const dx = position[0] - zone.center[0];
  const dz = position[2] - zone.center[1];
  const maxDistance = zone.radius - radius;
  const distance = Math.hypot(dx, dz);

  if (distance <= maxDistance || distance === 0) {
    return position;
  }

  const scale = maxDistance / distance;
  return [zone.center[0] + dx * scale, position[1], zone.center[1] + dz * scale];
}

function isValidPosition(position: Vec3, navigation: LayoutNavigation, radius: number): boolean {
  return !navigation.blockers.some((blocker) => hitsBlocker(position, blocker, radius));
}

function hitsBlocker(position: Vec3, blocker: Blocker, radius: number): boolean {
  if (blocker.type === "circle") {
    const dx = position[0] - blocker.center[0];
    const dz = position[2] - blocker.center[1];
    return Math.hypot(dx, dz) < blocker.radius + radius;
  }

  return (
    position[0] > blocker.minX - radius &&
    position[0] < blocker.maxX + radius &&
    position[2] > blocker.minZ - radius &&
    position[2] < blocker.maxZ + radius
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
