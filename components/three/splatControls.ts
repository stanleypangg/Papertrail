import { Camera, Group, Vector3 } from "three";

export type ThumbstickAxes = {
  x: number;
  y: number;
};

export type XRInputSnapshot = {
  leftStick: ThumbstickAxes | null;
  rightStick: ThumbstickAxes | null;
  rightButtons: Set<number>;
};

export type SplatControlContext = {
  camera: Camera;
  delta: number;
  isXR: boolean;
  keys: ReadonlySet<string>;
  rig: Group;
  webXRSession: XRSession | null;
  xrInput: XRInputSnapshot | null;
  yaw: number;
};

export type SplatControlProvider = (context: SplatControlContext) => void;

export const XR_STANDARD_TRIGGER_BUTTON_INDEX = 0;
export const XR_STANDARD_A_BUTTON_INDEX = 4;

type KeyboardControlOptions = {
  speed?: number;
};

type QuestThumbstickControlOptions = {
  moveDeadzone?: number;
  moveSpeed?: number;
  snapTurnDegrees?: number;
  turnDeadzone?: number;
};

type SnapTurnState = {
  ready: boolean;
};

const DEFAULT_KEYBOARD_SPEED = 1.2;
const DEFAULT_KEYBOARD_SPRINT_MULTIPLIER = 2.4;
const DEFAULT_XR_MOVE_SPEED = 1.15;
const DEFAULT_XR_MOVE_DEADZONE = 0.18;
const DEFAULT_XR_TURN_DEADZONE = 0.65;
const DEFAULT_XR_SNAP_TURN_DEGREES = 30;

const tempForward = new Vector3();
const tempRight = new Vector3();
const tempMove = new Vector3();

export function createKeyboardSplatControlProvider({
  speed = DEFAULT_KEYBOARD_SPEED
}: KeyboardControlOptions = {}): SplatControlProvider {
  return ({ delta, isXR, keys, rig, yaw }) => {
    if (isXR) {
      return;
    }

    const move = directionalMoveFromAxes(
      keyboardAxis(keys, "KeyA", "KeyD"),
      keyboardAxis(keys, "KeyS", "KeyW"),
      yaw,
      speed * keyboardSpeedMultiplier(keys) * delta
    );

    if (move) {
      rig.position.add(move);
    }
  };
}

export function createQuestThumbstickSplatControlProvider({
  moveDeadzone = DEFAULT_XR_MOVE_DEADZONE,
  moveSpeed = DEFAULT_XR_MOVE_SPEED,
  snapTurnDegrees = DEFAULT_XR_SNAP_TURN_DEGREES,
  turnDeadzone = DEFAULT_XR_TURN_DEADZONE
}: QuestThumbstickControlOptions = {}): SplatControlProvider {
  const snapTurnState: SnapTurnState = { ready: true };

  return ({ camera, delta, isXR, rig, webXRSession, xrInput }) => {
    if (!isXR || !webXRSession) {
      snapTurnState.ready = true;
      return;
    }

    const leftStick = xrInput?.leftStick ?? readXRThumbstick(webXRSession, "left");
    const rightStick = xrInput?.rightStick ?? readXRThumbstick(webXRSession, "right");

    const turnRadians = updateSnapTurn({
      axis: rightStick?.x ?? 0,
      deadzone: turnDeadzone,
      degrees: snapTurnDegrees,
      state: snapTurnState
    });

    if (turnRadians !== 0) {
      rig.rotation.y += turnRadians;
    }

    if (!leftStick) {
      return;
    }

    const xAxis = applyDeadzone(leftStick.x, moveDeadzone);
    const yAxis = applyDeadzone(leftStick.y, moveDeadzone);
    if (xAxis === 0 && yAxis === 0) {
      return;
    }

    camera.getWorldDirection(tempForward);
    tempForward.y = 0;
    tempForward.normalize();
    tempRight.crossVectors(tempForward, camera.up).normalize();
    tempMove.set(0, 0, 0);
    tempMove.addScaledVector(tempRight, xAxis);
    tempMove.addScaledVector(tempForward, -yAxis);

    if (tempMove.lengthSq() > 0) {
      tempMove.normalize().multiplyScalar(moveSpeed * delta);
      rig.position.add(tempMove);
    }
  };
}

export function createDefaultSplatControlProviders(): SplatControlProvider[] {
  return [
    createKeyboardSplatControlProvider(),
    createQuestThumbstickSplatControlProvider()
  ];
}

export function applyDeadzone(value: number, deadzone: number): number {
  return Math.abs(value) > deadzone ? value : 0;
}

export function readXRThumbstick(session: XRSession, handedness: XRHandedness): ThumbstickAxes | null {
  for (const inputSource of Array.from(session.inputSources)) {
    if (inputSource.handedness !== handedness) {
      continue;
    }

    const axes = readXRInputSourceAxes(inputSource);
    if (axes) {
      return axes;
    }
  }

  return null;
}

export function readXRInputSnapshot(session: Pick<XRSession, "inputSources"> | null): XRInputSnapshot | null {
  if (!session) {
    return null;
  }

  const snapshot: XRInputSnapshot = {
    leftStick: null,
    rightButtons: new Set<number>(),
    rightStick: null
  };

  for (const inputSource of Array.from(session.inputSources)) {
    const axes = readXRInputSourceAxes(inputSource);
    if (inputSource.handedness === "left") {
      snapshot.leftStick = axes;
      continue;
    }

    if (inputSource.handedness !== "right") {
      continue;
    }

    snapshot.rightStick = axes;
    inputSource.gamepad?.buttons.forEach((button, index) => {
      if (button.pressed) {
        snapshot.rightButtons.add(index);
      }
    });
  }

  return snapshot;
}

export function readXRGamepadButtonPressed(
  session: Pick<XRSession, "inputSources"> | null,
  handedness: XRHandedness,
  buttonIndex: number
): boolean {
  if (!session) {
    return false;
  }

  for (const inputSource of Array.from(session.inputSources)) {
    if (inputSource.handedness !== handedness) {
      continue;
    }

    if (Boolean(inputSource.gamepad?.buttons[buttonIndex]?.pressed)) {
      return true;
    }
  }

  return false;
}

export function readXRInputSourceAxes(inputSource: Pick<XRInputSource, "gamepad">): ThumbstickAxes | null {
  const axes = inputSource.gamepad?.axes;
  if (!axes || axes.length < 2) {
    return null;
  }

  if (axes.length >= 4) {
    return {
      x: axes[2] ?? 0,
      y: axes[3] ?? 0
    };
  }

  return {
    x: axes[0] ?? 0,
    y: axes[1] ?? 0
  };
}

export function updateSnapTurn({
  axis,
  deadzone,
  degrees,
  state
}: {
  axis: number;
  deadzone: number;
  degrees: number;
  state: SnapTurnState;
}): number {
  if (Math.abs(axis) < deadzone) {
    state.ready = true;
    return 0;
  }

  if (!state.ready) {
    return 0;
  }

  state.ready = false;
  return (axis > 0 ? -1 : 1) * degreesToRadians(degrees);
}

function directionalMoveFromAxes(xAxis: number, yAxis: number, yaw: number, distance: number): Vector3 | null {
  if (xAxis === 0 && yAxis === 0) {
    return null;
  }

  tempForward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  tempRight.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
  tempMove.set(0, 0, 0);
  tempMove.addScaledVector(tempRight, xAxis);
  tempMove.addScaledVector(tempForward, yAxis);

  if (tempMove.lengthSq() === 0) {
    return null;
  }

  return tempMove.normalize().multiplyScalar(distance).clone();
}

function keyboardAxis(keys: ReadonlySet<string>, negative: string, positive: string): number {
  return (keys.has(positive) ? 1 : 0) - (keys.has(negative) ? 1 : 0);
}

function keyboardSpeedMultiplier(keys: ReadonlySet<string>): number {
  return keys.has("ShiftLeft") || keys.has("ShiftRight") ? DEFAULT_KEYBOARD_SPRINT_MULTIPLIER : 1;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
