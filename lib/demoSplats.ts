import type { ScenePlan } from "./sceneSchema";

export type DemoSplatManifest = Record<string, {
  cachedAt: string;
  colliderPath?: string;
  path: string;
  sourceUrl: string;
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
