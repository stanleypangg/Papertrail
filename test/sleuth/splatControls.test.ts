import { describe, expect, it } from "vitest";

import {
  applyDeadzone,
  readXRInputSourceAxes,
  updateSnapTurn
} from "@/components/three/splatControls";

describe("splat controls", () => {
  it("zeros values inside the deadzone", () => {
    expect(applyDeadzone(0.17, 0.18)).toBe(0);
    expect(applyDeadzone(-0.18, 0.18)).toBe(0);
    expect(applyDeadzone(0.19, 0.18)).toBe(0.19);
    expect(applyDeadzone(-0.25, 0.18)).toBe(-0.25);
  });

  it("prefers Quest thumbstick axes and falls back to the first axis pair", () => {
    expect(readXRInputSourceAxes({
      gamepad: { axes: [0.1, 0.2, -0.7, 0.8] } as unknown as Gamepad
    })).toEqual({ x: -0.7, y: 0.8 });

    expect(readXRInputSourceAxes({
      gamepad: { axes: [-0.3, 0.4] } as unknown as Gamepad
    })).toEqual({ x: -0.3, y: 0.4 });
  });

  it("gates snap turns until the stick returns inside the threshold", () => {
    const state = { ready: true };
    const turn = { deadzone: 0.65, degrees: 30, state };

    expect(updateSnapTurn({ ...turn, axis: 0.7 })).toBeCloseTo(-Math.PI / 6);
    expect(updateSnapTurn({ ...turn, axis: 0.8 })).toBe(0);
    expect(updateSnapTurn({ ...turn, axis: 0.2 })).toBe(0);
    expect(updateSnapTurn({ ...turn, axis: -0.9 })).toBeCloseTo(Math.PI / 6);
  });
});
