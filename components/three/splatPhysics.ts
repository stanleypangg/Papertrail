import { Group, Object3D, Raycaster, Vector3 } from "three";

const GRAVITY = -9.8;
const GROUND_PROBE_HEIGHT = 3;
const GROUND_PROBE_DEPTH = 8;
const GROUND_SNAP_DISTANCE = 0.22;
const MAX_STEP_HEIGHT = 0.22;

const groundRaycaster = new Raycaster();
const tempRayOrigin = new Vector3();
const tempNormal = new Vector3();
const groundHits: ReturnType<Raycaster["intersectObjects"]> = [];

const STATIONARY_GROUND_EPSILON_SQ = 0.0025;

export type RigVerticalPhysicsState = {
  grounded: boolean;
  groundY: number;
  lastProbeX: number;
  lastProbeZ: number;
};

export function createRigVerticalPhysicsState(): RigVerticalPhysicsState {
  return {
    grounded: false,
    groundY: 0,
    lastProbeX: Number.NaN,
    lastProbeZ: Number.NaN
  };
}

export function updateRigVerticalPhysics(
  rig: Group,
  delta: number,
  colliders: Object3D[],
  verticalVelocity: number,
  state: RigVerticalPhysicsState = createRigVerticalPhysicsState()
) {
  if (colliders.length === 0) {
    rig.position.y = 0;
    state.grounded = true;
    state.groundY = 0;
    state.lastProbeX = rig.position.x;
    state.lastProbeZ = rig.position.z;
    return 0;
  }

  const canReuseGround = state.grounded
    && verticalVelocity === 0
    && Math.abs(rig.position.y - state.groundY) <= GROUND_SNAP_DISTANCE
    && horizontalDistanceSq(rig.position, state.lastProbeX, state.lastProbeZ) <= STATIONARY_GROUND_EPSILON_SQ;

  const ground = canReuseGround ? state.groundY : findGroundY(rig.position, colliders);
  if (ground === null) {
    state.grounded = false;
    return 0;
  }

  state.groundY = ground;
  state.lastProbeX = rig.position.x;
  state.lastProbeZ = rig.position.z;

  let nextVelocity = verticalVelocity + GRAVITY * delta;
  rig.position.y += nextVelocity * delta;

  if (nextVelocity <= 0 && rig.position.y <= ground + GROUND_SNAP_DISTANCE) {
    rig.position.y = ground;
    nextVelocity = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  return nextVelocity;
}

function findGroundY(position: Vector3, colliders: Object3D[]) {
  groundRaycaster.set(
    tempRayOriginFrom(position, 0, GROUND_PROBE_HEIGHT, 0),
    tempNormal.set(0, -1, 0)
  );
  groundRaycaster.far = GROUND_PROBE_DEPTH;
  groundRaycaster.firstHitOnly = true;

  groundHits.length = 0;
  groundRaycaster.intersectObjects(colliders, false, groundHits);
  for (const hit of groundHits) {
    if (!hit.face) {
      continue;
    }

    if (hit.point.y > position.y + MAX_STEP_HEIGHT) {
      continue;
    }

    tempNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (tempNormal.y > 0.45) {
      return hit.point.y;
    }
  }

  return null;
}

function tempRayOriginFrom(position: Vector3, x: number, y: number, z: number) {
  return tempRayOrigin.set(position.x + x, position.y + y, position.z + z);
}

function horizontalDistanceSq(position: Vector3, x: number, z: number) {
  const dx = position.x - x;
  const dz = position.z - z;
  return dx * dx + dz * dz;
}
