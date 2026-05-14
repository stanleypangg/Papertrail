import { describe, expect, it, vi } from "vitest";
import { createWorldGenerator } from "@/lib/sleuth/world-generator";
import type {
  GenerateInput,
  GenerateResult,
  PollResult,
  WorldGenerator,
} from "@/lib/sleuth/world-generator";

const sampleInput: GenerateInput = {
  script_id: "the-empress-last-tea",
  world_prompt: { type: "text", text_prompt: "tea parlour" },
};

describe("createWorldGenerator", () => {
  it("returns the bare mock provider when provider is 'mock' (no degraded flag)", async () => {
    const generator = createWorldGenerator("mock");
    const result = await generator.generate(sampleInput);

    expect(result.operation_id).toMatch(/^mock-the-empress-last-tea-/);
    expect(result.degraded).toBeUndefined();
  });

  it("uses the worldlabs override when provider is 'worldlabs' and it succeeds", async () => {
    const worldlabs: WorldGenerator = {
      generate: vi.fn(
        async (): Promise<GenerateResult> => ({ operation_id: "op_real" }),
      ),
      poll: vi.fn(
        async (): Promise<PollResult> => ({
          done: true,
          splat_url: "https://cdn.example/real.spz",
        }),
      ),
    };
    const mock: WorldGenerator = {
      generate: vi.fn(),
      poll: vi.fn(),
    };

    const generator = createWorldGenerator("worldlabs", { worldlabs, mock });
    const result = await generator.generate(sampleInput);

    expect(result).toEqual({ operation_id: "op_real" });
    expect(result.degraded).toBeUndefined();
    expect(worldlabs.generate).toHaveBeenCalledTimes(1);
    expect(mock.generate).not.toHaveBeenCalled();
  });

  // Demo-day safety-net regression — when Marble flickers on stage, the demo still plays.
  it("falls back to the mock provider with degraded:true when worldlabs throws", async () => {
    const worldlabs: WorldGenerator = {
      generate: vi.fn(async () => {
        throw new Error("marble unreachable");
      }),
      poll: vi.fn(),
    };
    const mockGenerate = vi.fn(
      async (input: GenerateInput): Promise<GenerateResult> => ({
        operation_id: `mock-${input.script_id}-stub`,
      }),
    );
    const mock: WorldGenerator = {
      generate: mockGenerate,
      poll: vi.fn(),
    };

    const generator = createWorldGenerator("worldlabs", { worldlabs, mock });
    const result = await generator.generate(sampleInput);

    expect(result.degraded).toBe(true);
    expect(result.operation_id).toBe("mock-the-empress-last-tea-stub");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0][0].script_id).toBe(
      "the-empress-last-tea",
    );
  });
});
