import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const imagesGenerateMock = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class OpenAI {
    images = {
      generate: imagesGenerateMock,
    };
  },
}));

describe("lib/sleuth/images/client", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "sleuth-images-"));
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    imagesGenerateMock.mockReset();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns immediately on cache hit without calling OpenAI", async () => {
    const outPath = path.join(tempDir, "mei-lin.png");
    writeFileSync(outPath, "cached-file");

    const { generatePortrait } = await import("@/lib/sleuth/images/client");
    const result = await generatePortrait({
      characterName: "Mei-Lin",
      publicBrief: "The empress's adopted daughter.",
      scriptMood: "1920s Shanghai parlour at dusk.",
      outPath,
    });

    expect(result).toBe(outPath);
    expect(imagesGenerateMock).not.toHaveBeenCalled();
    expect(readFileSync(outPath, "utf8")).toBe("cached-file");
  });

  it("calls OpenAI on cache miss and writes the decoded PNG bytes to disk", async () => {
    const outPath = path.join(tempDir, "madam-wu.png");
    const pngBytes = Buffer.from("portrait-bytes");
    imagesGenerateMock.mockResolvedValue({
      data: [{ b64_json: pngBytes.toString("base64") }],
    });

    const { generatePortrait } = await import("@/lib/sleuth/images/client");
    const result = await generatePortrait({
      characterName: "Madam Wu",
      publicBrief: "A tea-house patron with perfect posture.",
      scriptMood: "Oil-lamp warmth and lacquered screens.",
      outPath,
    });

    expect(result).toBe(outPath);
    expect(imagesGenerateMock).toHaveBeenCalledTimes(1);
    expect(imagesGenerateMock.mock.calls[0]?.[0]).toMatchObject({
      model: "gpt-image-1",
      size: "1024x1024",
    });
    expect(readFileSync(outPath)).toEqual(pngBytes);
  });

  it("propagates OpenAI failures so the caller can fall back to placeholder portraits", async () => {
    const outPath = path.join(tempDir, "inspector-ren.png");
    imagesGenerateMock.mockRejectedValue(new Error("policy refusal"));

    const { generatePortrait } = await import("@/lib/sleuth/images/client");

    await expect(
      generatePortrait({
        characterName: "Inspector Ren",
        publicBrief: "The detective called in too late.",
        scriptMood: "Cinnabar accents and heavy shadow.",
        outPath,
      }),
    ).rejects.toThrow("policy refusal");
  });
});
