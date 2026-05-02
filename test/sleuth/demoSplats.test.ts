import { describe, expect, it } from "vitest";

import { nextSplatSceneIndex } from "@/lib/demoSplats";
import type { ScenePlan } from "@/lib/sceneSchema";

const scenes = [
  scene("scene-one"),
  scene("scene-two"),
  scene("scene-three"),
  scene("scene-four")
];

describe("demo splat scene navigation", () => {
  it("advances to the next splat scene", () => {
    expect(nextSplatSceneIndex(scenes, {
      "scene-one": "/splats/one.spz",
      "scene-two": "/splats/two.spz",
      "scene-three": null,
      "scene-four": null
    }, 0)).toBe(1);
  });

  it("skips scenes without splats", () => {
    expect(nextSplatSceneIndex(scenes, {
      "scene-one": "/splats/one.spz",
      "scene-two": null,
      "scene-three": null,
      "scene-four": "/splats/four.spz"
    }, 0)).toBe(3);
  });

  it("wraps to the first splat scene at the end", () => {
    expect(nextSplatSceneIndex(scenes, {
      "scene-one": "/splats/one.spz",
      "scene-two": null,
      "scene-three": "/splats/three.spz",
      "scene-four": null
    }, 2)).toBe(0);
  });
});

function scene(id: string): ScenePlan {
  return {
    id,
    title: id,
    summary: "Summary.",
    layoutType: "exhibit_space",
    dressing: "A room.",
    mood: "neutral",
    stylePrompt: "Cinematic room.",
    narration: "Narration.",
    sourceAnchors: [],
    objects: [
      {
        id: `${id}-object`,
        label: "Object",
        visualType: "artifact",
        description: "A prop.",
        quote: "A quote.",
        explanation: "An explanation.",
        slot: "center"
      }
    ],
    transitionToNext: {
      label: "Next",
      description: "Move onward."
    }
  };
}
