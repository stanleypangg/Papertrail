import { z } from "zod";

import type { ScenePlan } from "./sceneSchema";

export const objectModelStatuses = ["succeeded", "failed", "timeout", "skipped"] as const;

export const generatedObjectModelSchema = z.object({
  modelUrl: z.string().nullable(),
  taskId: z.string().optional(),
  status: z.enum(objectModelStatuses),
  warning: z.string().optional()
});

export const sceneObjectModelMapSchema = z.record(z.string(), z.record(z.string(), generatedObjectModelSchema));

export type ObjectModelStatus = (typeof objectModelStatuses)[number];
export type GeneratedObjectModel = z.infer<typeof generatedObjectModelSchema>;
export type SceneObjectModelMap = z.infer<typeof sceneObjectModelMapSchema>;


export type GenerateObjectModelsResponse = {
  models: SceneObjectModelMap;
  warnings: string[];
};

export function emptyObjectModelMap(scenes: ScenePlan[], status: ObjectModelStatus, warning?: string): SceneObjectModelMap {
  return Object.fromEntries(
    scenes.map((scene) => [
      scene.id,
      Object.fromEntries(
        scene.objects.map((object) => [
          object.id,
          {
            modelUrl: null,
            status,
            warning
          } satisfies GeneratedObjectModel
        ])
      )
    ])
  ) as SceneObjectModelMap;
}
