import type { ScenePlan } from "./sceneSchema";

export type DemoSplatManifest = Record<string, {
  cachedAt: string;
  path: string;
  sourceUrl: string;
}>;

export type SceneSplatMap = Record<string, string | null>;

export const DEMO_SPLAT_MANIFEST_URL = "/splats/demo/manifest.json";

export function emptySceneSplatMap(scenes: ScenePlan[]): SceneSplatMap {
  return Object.fromEntries(scenes.map((scene) => [scene.id, null])) as SceneSplatMap;
}

export function sceneSplatsFromManifest(scenes: ScenePlan[], manifest: DemoSplatManifest | null): SceneSplatMap {
  return Object.fromEntries(
    scenes.map((scene) => [scene.id, manifest?.[scene.id]?.path ?? scene.integrations?.walkableWorld?.splatUrl ?? null])
  ) as SceneSplatMap;
}
