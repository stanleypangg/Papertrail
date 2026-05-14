import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("lib/sleuth/scripts", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("loads the empress last tea script with typed world, cast, clues, and endings", async () => {
    const { loadScript } = await import("@/lib/sleuth/scripts");

    const script = loadScript("the-empress-last-tea");

    expect(script.id).toBe("the-empress-last-tea");
    expect(script.title).toContain("Empress");
    expect(script.worldPrompt.type).toBe("text");
    expect(script.worldPrompt.text_prompt).toContain("Shanghai");
    expect(script.cast.length).toBeGreaterThanOrEqual(5);
    expect(script.clues.length).toBeGreaterThanOrEqual(3);
    expect(script.endings.correct_accusation.score).toBe(100);
    expect(script.endings.wrong_accusation.score).toBe(0);
  });

  it("enforces the demo-script invariants for murderer count and committed portrait assets", async () => {
    const { loadScript } = await import("@/lib/sleuth/scripts");

    const script = loadScript("the-empress-last-tea");
    const murderers = script.cast.filter((character) => character.isMurderer);

    expect(murderers).toHaveLength(1);

    for (const character of script.cast) {
      const relativePath = character.portrait.startsWith("/")
        ? character.portrait.slice(1)
        : character.portrait;
      const absolutePath = path.join(process.cwd(), "public", relativePath.replace(/^public\//, ""));
      expect(existsSync(absolutePath)).toBe(true);
    }
  });

  it("throws a clear error for an unknown script id", async () => {
    const { loadScript } = await import("@/lib/sleuth/scripts");

    expect(() => loadScript("missing-script")).toThrow(
      "Unknown Sleuth script: missing-script",
    );
  });
});
