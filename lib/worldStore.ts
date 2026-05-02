import { randomUUID } from "crypto";

import type { CreateWorldPayload, StoredWorld } from "./worldSchema";

type WorldStoreGlobal = typeof globalThis & {
  __pageWorldWorlds?: Map<string, StoredWorld>;
};

const globalStore = globalThis as WorldStoreGlobal;
const worlds = globalStore.__pageWorldWorlds ?? new Map<string, StoredWorld>();

globalStore.__pageWorldWorlds = worlds;

export function saveWorld(payload: CreateWorldPayload): StoredWorld {
  const world: StoredWorld = {
    ...payload,
    id: randomUUID(),
    title: payload.scenes[0]?.title ?? "Untitled world",
    createdAt: new Date().toISOString()
  };

  worlds.set(world.id, world);

  return world;
}

export function getWorld(id: string): StoredWorld | null {
  return worlds.get(id) ?? null;
}
