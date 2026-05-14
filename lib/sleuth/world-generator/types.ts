import type { components } from "./marble.gen";

export type MarbleWorldsGenerateRequest =
  components["schemas"]["WorldsGenerateRequest"];

export type MarbleGetOperationResponse =
  components["schemas"]["GetOperationResponse_Union_World__PanoDepthToRgbResult__"];

export interface WorldPrompt {
  type: "text";
  text_prompt: string;
  disable_recaption?: boolean | null;
}

export interface GenerateInput {
  script_id: string;
  world_prompt: WorldPrompt;
  display_name?: string;
}

export interface GenerateResult {
  operation_id: string;
  degraded?: boolean;
}

export interface PollResult {
  done: boolean;
  splat_url?: string;
  degraded?: boolean;
  error?: string;
}

export interface WorldGenerator {
  generate(input: GenerateInput): Promise<GenerateResult>;
  poll(operation_id: string): Promise<PollResult>;
}

export class MarbleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarbleAuthError";
  }
}

export class MarbleRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarbleRateLimitError";
  }
}

export class MarbleServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarbleServerError";
  }
}

export type MarbleOperationErrorKind = "failed" | "expired" | "no-assets";

export class MarbleOperationError extends Error {
  readonly kind: MarbleOperationErrorKind;

  constructor(message: string, kind: MarbleOperationErrorKind = "failed") {
    super(message);
    this.name = "MarbleOperationError";
    this.kind = kind;
  }
}
