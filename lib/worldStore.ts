import { randomInt, randomUUID } from "crypto";

import type { CreateWorldPayload, StoredWorld } from "./worldSchema";

type WorldStoreGlobal = typeof globalThis & {
  __papertrailWorlds?: Map<string, StoredWorld>;
  __papertrailJoinCodes?: Map<string, string>;
};

const globalStore = globalThis as WorldStoreGlobal;
const worlds = globalStore.__papertrailWorlds ?? new Map<string, StoredWorld>();
const joinCodes = globalStore.__papertrailJoinCodes ?? new Map<string, string>();

globalStore.__papertrailWorlds = worlds;
globalStore.__papertrailJoinCodes = joinCodes;

export function saveWorld(payload: CreateWorldPayload): StoredWorld {
  const id = randomUUID();
  const joinCode = createJoinCode();
  const world: StoredWorld = {
    ...payload,
    id,
    joinCode,
    title: payload.scenes[0]?.title ?? "Untitled world",
    createdAt: new Date().toISOString()
  };

  worlds.set(world.id, world);
  joinCodes.set(joinCode, id);

  return world;
}

export function getWorld(identifier: string): StoredWorld | null {
  const normalized = identifier.trim().toUpperCase();
  const id = worlds.has(identifier) ? identifier : joinCodes.get(normalized);

  return id ? worlds.get(id) ?? null : null;
}

const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const JOIN_CODE_LENGTH = 5;

function createJoinCode(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from({ length: JOIN_CODE_LENGTH }, () => JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)]).join("");

    if (!joinCodes.has(code)) {
      return code;
    }
  }

  return randomUUID().replace(/-/g, "").slice(0, JOIN_CODE_LENGTH).toUpperCase();
}
