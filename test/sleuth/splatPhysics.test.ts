import { describe, expect, it } from "vitest";
import { DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

import { createRigVerticalPhysicsState, updateRigVerticalPhysics } from "@/components/three/splatPhysics";

describe("splat physics", () => {
  it("applies downward velocity while above ground", () => {
    const rig = new Group();
    rig.position.set(0, 1, 0);

    const velocity = updateRigVerticalPhysics(rig, 0.1, [groundPlane(0)], 0);

    expect(velocity).toBeCloseTo(-0.98);
    expect(rig.position.y).toBeCloseTo(0.902);
  });

  it("snaps to upward-facing ground and clears velocity", () => {
    const rig = new Group();
    rig.position.set(0, 0.1, 0);

    const velocity = updateRigVerticalPhysics(rig, 0.1, [groundPlane(0)], 0);

    expect(velocity).toBe(0);
    expect(rig.position.y).toBe(0);
  });

  it("resets height and velocity when there are no colliders", () => {
    const rig = new Group();
    rig.position.set(0, 2, 0);

    const velocity = updateRigVerticalPhysics(rig, 0.1, [], -3);

    expect(velocity).toBe(0);
    expect(rig.position.y).toBe(0);
  });

  it("ignores surfaces above the max step height", () => {
    const rig = new Group();
    rig.position.set(0, 0, 0);

    const velocity = updateRigVerticalPhysics(rig, 0.1, [groundPlane(0.5)], -1);

    expect(velocity).toBe(0);
    expect(rig.position.y).toBe(0);
  });

  it("ignores non-ground surfaces", () => {
    const rig = new Group();
    rig.position.set(0, 0.1, 0);

    const velocity = updateRigVerticalPhysics(rig, 0.1, [wallPlane()], -1);

    expect(velocity).toBe(0);
    expect(rig.position.y).toBe(0.1);
  });

  it("reuses the cached ground while grounded and stationary", () => {
    const rig = new Group();
    const ground = groundPlane(0);
    const state = createRigVerticalPhysicsState();
    let raycasts = 0;
    const originalRaycast = ground.raycast.bind(ground);
    ground.raycast = (raycaster, intersects) => {
      raycasts += 1;
      originalRaycast(raycaster, intersects);
    };

    updateRigVerticalPhysics(rig, 0.1, [ground], 0, state);
    updateRigVerticalPhysics(rig, 0.1, [ground], 0, state);

    expect(raycasts).toBe(1);
    expect(rig.position.y).toBe(0);
  });

  it("re-probes ground after meaningful horizontal movement", () => {
    const rig = new Group();
    const ground = groundPlane(0);
    const state = createRigVerticalPhysicsState();
    let raycasts = 0;
    const originalRaycast = ground.raycast.bind(ground);
    ground.raycast = (raycaster, intersects) => {
      raycasts += 1;
      originalRaycast(raycaster, intersects);
    };

    updateRigVerticalPhysics(rig, 0.1, [ground], 0, state);
    rig.position.x = 0.1;
    updateRigVerticalPhysics(rig, 0.1, [ground], 0, state);

    expect(raycasts).toBe(2);
  });
});

function groundPlane(y: number) {
  const mesh = new Mesh(new PlaneGeometry(10, 10), new MeshBasicMaterial());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.updateMatrixWorld(true);
  return mesh;
}

function wallPlane() {
  const mesh = new Mesh(new PlaneGeometry(10, 10), new MeshBasicMaterial({ side: DoubleSide }));
  mesh.rotation.x = Math.PI / 2;
  mesh.updateMatrixWorld(true);
  return mesh;
}
