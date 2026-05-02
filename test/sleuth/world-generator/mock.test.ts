import { describe, expect, it } from "vitest";
import {
  DEFAULT_FALLBACK_SPLAT_URL,
  MockProvider,
} from "@/lib/sleuth/world-generator";

describe("MockProvider", () => {
  it("returns the mapped splat url when script_id is present in the map", async () => {
    const mapped = "/splats/sleuth/custom-mansion.splat";
    const provider = new MockProvider(
      new Map([["the-empress-last-tea", mapped]]),
    );

    const generated = await provider.generate({
      script_id: "the-empress-last-tea",
      world_prompt: { type: "text", text_prompt: "ignored" },
    });

    expect(generated.operation_id).toMatch(/^mock-the-empress-last-tea-/);

    const polled = await provider.poll(generated.operation_id);
    expect(polled).toEqual({ done: true, splat_url: mapped });
  });

  it("returns DEFAULT_FALLBACK_SPLAT_URL when script_id is not in the map", async () => {
    const provider = new MockProvider();

    const generated = await provider.generate({
      script_id: "unknown-script",
      world_prompt: { type: "text", text_prompt: "ignored" },
    });

    const polled = await provider.poll(generated.operation_id);
    expect(polled).toEqual({
      done: true,
      splat_url: DEFAULT_FALLBACK_SPLAT_URL,
    });
  });
});
