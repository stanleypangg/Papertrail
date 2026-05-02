import type { ScenePlan } from "./sceneSchema";

export type SceneImageMap = Record<string, string | null>;

export const IMAGE_PROMPT_VERSION = "geometry-mural-v1";

export function sceneImageKey(scene: ScenePlan): string {
  return `${IMAGE_PROMPT_VERSION}:${scene.id}`;
}

export function visibleSceneImages(scenes: ScenePlan[], images: SceneImageMap): SceneImageMap {
  return Object.fromEntries(scenes.map((scene) => [scene.id, images[sceneImageKey(scene)] ?? null])) as SceneImageMap;
}
