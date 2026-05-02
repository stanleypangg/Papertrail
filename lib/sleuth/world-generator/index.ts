import { MockProvider } from "./mock";
import type {
  GenerateInput,
  GenerateResult,
  PollResult,
  WorldGenerator,
} from "./types";
import { WorldlabsProvider } from "./worldlabs";

export type WorldProviderName = "worldlabs" | "mock";

export interface WorldGeneratorOverrides {
  worldlabs?: WorldGenerator;
  mock?: WorldGenerator;
}

const MOCK_OPERATION_PREFIX = "mock-";

class WorldlabsWithMockFallback implements WorldGenerator {
  constructor(
    private readonly worldlabs: WorldGenerator,
    private readonly mock: WorldGenerator,
  ) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    try {
      return await this.worldlabs.generate(input);
    } catch {
      const fallback = await this.mock.generate(input);
      return { operation_id: fallback.operation_id, degraded: true };
    }
  }

  async poll(operation_id: string): Promise<PollResult> {
    if (operation_id.startsWith(MOCK_OPERATION_PREFIX)) {
      const result = await this.mock.poll(operation_id);
      return { ...result, degraded: true };
    }
    try {
      return await this.worldlabs.poll(operation_id);
    } catch {
      const fallback = await this.mock.poll(operation_id);
      return { ...fallback, degraded: true };
    }
  }
}

function resolveProvider(provider?: WorldProviderName): WorldProviderName {
  if (provider) {
    return provider;
  }
  const fromEnv = process.env.SLEUTH_WORLD_PROVIDER;
  if (fromEnv === "mock") {
    return "mock";
  }
  return "worldlabs";
}

export function createWorldGenerator(
  provider?: WorldProviderName,
  overrides?: WorldGeneratorOverrides,
): WorldGenerator {
  const resolved = resolveProvider(provider);
  const mock = overrides?.mock ?? new MockProvider();

  if (resolved === "mock") {
    return mock;
  }

  const worldlabs = overrides?.worldlabs ?? new WorldlabsProvider();
  return new WorldlabsWithMockFallback(worldlabs, mock);
}

export const worldGenerator: WorldGenerator = createWorldGenerator();

export type {
  GenerateInput,
  GenerateResult,
  PollResult,
  WorldGenerator,
  WorldPrompt,
} from "./types";
export {
  MarbleAuthError,
  MarbleOperationError,
  MarbleRateLimitError,
  MarbleServerError,
} from "./types";
export { MockProvider, DEFAULT_FALLBACK_SPLAT_URL } from "./mock";
export { WorldlabsProvider } from "./worldlabs";
