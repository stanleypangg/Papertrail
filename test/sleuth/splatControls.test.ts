import { describe, expect, it } from "vitest";

import {
  applyDeadzone,
  readXRGamepadButtonPressed,
  readXRInputSourceAxes,
  readXRInputSnapshot,
  updateSnapTurn,
  XR_STANDARD_A_BUTTON_INDEX,
  XR_STANDARD_TRIGGER_BUTTON_INDEX
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

  it("reads the right trigger pressed state from xr-standard button index 0", () => {
    expect(readXRGamepadButtonPressed(fakeSession([
      fakeInputSource("right", [true])
    ]), "right", XR_STANDARD_TRIGGER_BUTTON_INDEX)).toBe(true);

    expect(readXRGamepadButtonPressed(fakeSession([
      fakeInputSource("right", [false])
    ]), "right", XR_STANDARD_TRIGGER_BUTTON_INDEX)).toBe(false);
  });

  it("reads the right A button pressed state from xr-standard button index 4", () => {
    expect(readXRGamepadButtonPressed(fakeSession([
      fakeInputSource("right", [false, false, false, false, true])
    ]), "right", XR_STANDARD_A_BUTTON_INDEX)).toBe(true);

    expect(readXRGamepadButtonPressed(fakeSession([
      fakeInputSource("right", [false, false, false, false, false])
    ]), "right", XR_STANDARD_A_BUTTON_INDEX)).toBe(false);
  });

  it("reads thumbsticks and pressed buttons in one xr input snapshot", () => {
    const snapshot = readXRInputSnapshot(fakeSession([
      fakeInputSource("left", [], [0, 0, 0.25, -0.5]),
      fakeInputSource("right", [true, false, false, false, true], [0, 0, -0.75, 0.1])
    ]));

    expect(snapshot?.leftStick).toEqual({ x: 0.25, y: -0.5 });
    expect(snapshot?.rightStick).toEqual({ x: -0.75, y: 0.1 });
    expect(snapshot?.rightButtons.has(XR_STANDARD_TRIGGER_BUTTON_INDEX)).toBe(true);
    expect(snapshot?.rightButtons.has(XR_STANDARD_A_BUTTON_INDEX)).toBe(true);
  });

  it("treats missing gamepads and buttons as unpressed", () => {
    expect(readXRGamepadButtonPressed(null, "right", XR_STANDARD_TRIGGER_BUTTON_INDEX)).toBe(false);
    expect(readXRGamepadButtonPressed(fakeSession([
      { handedness: "right", gamepad: undefined } as unknown as XRInputSource
    ]), "right", XR_STANDARD_TRIGGER_BUTTON_INDEX)).toBe(false);
    expect(readXRGamepadButtonPressed(fakeSession([
      fakeInputSource("right", [])
    ]), "right", XR_STANDARD_A_BUTTON_INDEX)).toBe(false);
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

function fakeSession(inputSources: XRInputSource[]): Pick<XRSession, "inputSources"> {
  return {
    inputSources: inputSources as unknown as XRInputSourceArray
  };
}

function fakeInputSource(handedness: XRHandedness, pressedButtons: boolean[], axes: number[] = []): XRInputSource {
  return {
    handedness,
    gamepad: {
      axes,
      buttons: pressedButtons.map((pressed) => ({ pressed }))
    } as unknown as Gamepad
  } as unknown as XRInputSource;
}
