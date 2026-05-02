import type {
  GenerateInput,
  GenerateResult,
  PollResult,
  WorldGenerator,
} from "./types";

export const DEFAULT_FALLBACK_SPLAT_URL =
  "/splats/sleuth/the-empress-last-tea-cached.splat";

export class MockProvider implements WorldGenerator {
  private readonly scriptIdToSplat: Map<string, string>;
  private readonly fallbackSplatUrl: string;
  private readonly operationToSplat: Map<string, string>;

  constructor(
    scriptIdToSplat: Map<string, string> = new Map(),
    fallbackSplatUrl: string = DEFAULT_FALLBACK_SPLAT_URL,
  ) {
    this.scriptIdToSplat = scriptIdToSplat;
    this.fallbackSplatUrl = fallbackSplatUrl;
    this.operationToSplat = new Map();
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const operation_id = `mock-${input.script_id}-${Date.now()}`;
    const splat_url =
      this.scriptIdToSplat.get(input.script_id) ?? this.fallbackSplatUrl;
    this.operationToSplat.set(operation_id, splat_url);
    return { operation_id };
  }

  async poll(operation_id: string): Promise<PollResult> {
    const splat_url =
      this.operationToSplat.get(operation_id) ?? this.fallbackSplatUrl;
    return { done: true, splat_url };
  }
}
