import { layoutSpecs, type Blocker, type Vec3, type WalkZone } from "./layoutSpecs";
import type { LayoutType, SceneObject } from "./sceneSchema";

export type { Blocker, Vec2, Vec3, WalkZone } from "./layoutSpecs";

export type WorldTarget =
  | { type: "object"; id: SceneObject["id"] }
  | { type: "portal" };

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

export const layoutNavigation: Record<LayoutType, LayoutNavigation> = Object.fromEntries(
  Object.entries(layoutSpecs).map(([layoutType, spec]) => [
    layoutType,
    {
      spawn: spec.spawn,
      walkZone: spec.walkZone,
      blockers: spec.blockers
    }
  ])
) as Record<LayoutType, LayoutNavigation>;

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
