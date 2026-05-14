import type { GeneratedObjectModel, SceneObjectModelMap } from "./objectModels";
import type { SceneImageMap } from "./sceneImages";
import type { ScenePlan } from "./sceneSchema";

export type GenerationStage =
  | "initializing"
  | "parsing"
  | "planning"
  | "narration"
  | "images"
  | "models"
  | "saving"
  | "complete";

export type GenerationStatus = "pending" | "active" | "complete" | "warning" | "error";

export type GenerationProgressEvent = {
  type: "progress";
  stage: GenerationStage;
  status: GenerationStatus;
  percent: number;
  title: string;
  detail?: string;
  log?: string;
};

export type GenerationImageCompleteEvent = {
  type: "image-complete";
  sceneId: string;
  imageKey: string;
  imageUrl: string | null;
  warning?: string;
};

export type GenerationModelProgressEvent = {
  type: "model-progress";
  sceneId: string;
  objectId: string;
  label: string;
  taskId?: string;
  providerProgress: number | null;
  status: string;
};

export type GenerationModelCompleteEvent = {
  type: "model-complete";
  sceneId: string;
  objectId: string;
  model: GeneratedObjectModel;
};

export type GenerationCompleteEvent = {
  type: "complete";
  scenes: ScenePlan[];
  sceneImages: SceneImageMap;
  objectModels: SceneObjectModelMap;
  source: string;
  warnings: string[];
  sharePath: string | null;
  joinCode: string | null;
};

export type GenerationErrorEvent = {
  type: "error";
  message: string;
};

export type WorldGenerationEvent =
  | GenerationProgressEvent
  | GenerationImageCompleteEvent
  | GenerationModelProgressEvent
  | GenerationModelCompleteEvent
  | GenerationCompleteEvent
  | GenerationErrorEvent;
