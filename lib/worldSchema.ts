import { z } from "zod";

import { sceneObjectModelMapSchema } from "./objectModels";
import { scenePlanSchema } from "./sceneSchema";

export const sceneImageMapSchema = z.record(z.string(), z.string().nullable());

export const createWorldPayloadSchema = z.object({
  scenes: z.array(scenePlanSchema).min(1).max(3),
  sceneImages: sceneImageMapSchema.default({}),
  objectModels: sceneObjectModelMapSchema.default({}),
  source: z.string().min(1).default("unknown"),
  warnings: z.array(z.string()).default([])
});

export const storedWorldSchema = createWorldPayloadSchema.extend({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string().min(1)
});

export type SceneImageMap = z.infer<typeof sceneImageMapSchema>;
export type CreateWorldPayload = z.infer<typeof createWorldPayloadSchema>;
export type StoredWorld = z.infer<typeof storedWorldSchema>;
