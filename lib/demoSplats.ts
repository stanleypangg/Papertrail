import type { ScenePlan } from "./sceneSchema";

export type DemoSplatManifest = Record<string, {
  cachedAt: string;
  colliderPath?: string;
  latestVersion?: string;
  path: string;
  sourceUrl: string;
  versions?: Array<{
    cachedAt: string;
    colliderPath?: string;
    path: string;
    sourceUrl: string;
    version: string;
  }>;
}>;

export type SceneSplatMap = Record<string, string | null>;
export type SceneColliderMap = Record<string, string | null>;

export const DEMO_SPLAT_MANIFEST_URL = "/splats/demo/manifest.json";

export function emptySceneSplatMap(scenes: ScenePlan[]): SceneSplatMap {
  return Object.fromEntries(scenes.map((scene) => [scene.id, null])) as SceneSplatMap;
}

export function emptySceneColliderMap(scenes: ScenePlan[]): SceneColliderMap {
  return Object.fromEntries(scenes.map((scene) => [scene.id, null])) as SceneColliderMap;
}

export function sceneSplatsFromManifest(scenes: ScenePlan[], manifest: DemoSplatManifest | null): SceneSplatMap {
  return Object.fromEntries(
    scenes.map((scene) => [scene.id, manifest?.[scene.id]?.path ?? scene.integrations?.walkableWorld?.splatUrl ?? null])
  ) as SceneSplatMap;
}

export function sceneCollidersFromManifest(scenes: ScenePlan[], manifest: DemoSplatManifest | null): SceneColliderMap {
  return Object.fromEntries(
    scenes.map((scene) => [scene.id, manifest?.[scene.id]?.colliderPath ?? null])
  ) as SceneColliderMap;
}

export function firstSplatSceneIndex(scenes: Pick<ScenePlan, "id">[], sceneSplats: SceneSplatMap): number {
  const index = scenes.findIndex((scene) => Boolean(sceneSplats[scene.id]));
  return Math.max(index, 0);
}

export function nextSplatSceneIndex(
  scenes: Pick<ScenePlan, "id">[],
  sceneSplats: SceneSplatMap,
  currentIndex: number
): number | null {
  if (scenes.length === 0) {
    return null;
  }

  for (let offset = 1; offset <= scenes.length; offset += 1) {
    const index = (currentIndex + offset) % scenes.length;
    if (sceneSplats[scenes[index]?.id ?? ""]) {
      return index;
    }
  }

  return null;
}
