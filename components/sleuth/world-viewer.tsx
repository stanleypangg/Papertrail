"use client";

import { Html, OrbitControls, PointerLockControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { MousePointer2, Move3D } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box3,
  MathUtils,
  Vector3,
} from "three";

import { NpcSprite } from "@/components/sleuth/npc-sprite";
import type { ScriptCharacter } from "@/lib/sleuth/scripts.types";

const PLAYER_HEIGHT = 1.65;
const WALK_BOUNDS = new Box3(
  new Vector3(-6.5, PLAYER_HEIGHT, -6.5),
  new Vector3(6.5, PLAYER_HEIGHT, 6.5),
);

interface WorldViewerProps {
  activeNpcId: string | null;
  cast: ScriptCharacter[];
  degraded: boolean;
  onSelectNpc: (npcId: string) => void;
  splatUrl: string;
}

type MovementKeys = {
  backward: boolean;
  forward: boolean;
  left: boolean;
  right: boolean;
};

export function WorldViewer({
  activeNpcId,
  cast,
  degraded,
  onSelectNpc,
  splatUrl,
}: WorldViewerProps) {
  const [pointerLocked, setPointerLocked] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);

  return (
    <section className="relative h-full min-h-[24rem] overflow-hidden border border-white/10 bg-[#0c0908] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      {degraded ? (
        <div className="absolute left-4 top-4 z-20 border border-white/12 bg-[#181211]/92 px-3 py-2 text-[0.72rem] uppercase tracking-[0.26em] text-[#c9bbb0]">
          Showing pre-rendered scene (Marble unreachable)
        </div>
      ) : null}

      <div className="absolute inset-x-4 bottom-4 z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="border border-white/10 bg-[#100c0b]/86 px-4 py-3 text-sm text-[#efe2cc] backdrop-blur-sm">
          <div className="inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.26em] text-[#b88f6b]">
            <Move3D className="size-4" />
            Walk the parlour
          </div>
          <p className="mt-2 max-w-md leading-6 text-[#d7c8b5]">
            WASD moves through the room. Mouse look takes over after you enter the
            view. Click a suspect to open a private exchange.
          </p>
        </div>

        <button
          id="sleuth-world-lock"
          type="button"
          className="inline-flex min-h-11 items-center gap-3 border border-white/12 bg-[#110d0c]/90 px-4 text-sm uppercase tracking-[0.22em] text-[#f3e7d3] backdrop-blur-sm transition hover:border-[#a8331a]"
        >
          <MousePointer2 className="size-4" />
          {pointerLocked ? "Mouse locked" : "Enter view"}
        </button>
      </div>

      <Canvas
        className="h-full w-full"
        camera={{ fov: 55, position: [0, 4.8, 10.5] }}
        gl={{ alpha: true, antialias: false }}
      >
        <color attach="background" args={["#0c0908"]} />
        <fog attach="fog" args={["#0c0908", 7, 22]} />
        <ambientLight intensity={0.8} color="#f2dfc7" />
        <directionalLight position={[3, 6, 4]} intensity={1.2} color="#ffe9c5" />
        <directionalLight position={[-4, 2, -5]} intensity={0.45} color="#b67b5d" />

        <SparkScene splatUrl={splatUrl} />
        <GroundPlane />
        <EntryCameraRig
          introComplete={introComplete}
          onComplete={() => setIntroComplete(true)}
          pointerLocked={pointerLocked}
        />
        <WalkRig introComplete={introComplete} pointerLocked={pointerLocked} />
        <OrbitControls
          enabled={!pointerLocked}
          enablePan={false}
          enableDamping
          maxDistance={11}
          minDistance={4}
          target={[0, 1.4, 0]}
        />
        <PointerLockControls
          selector="#sleuth-world-lock"
          onLock={() => setPointerLocked(true)}
          onUnlock={() => setPointerLocked(false)}
        />

        {cast.map((character) => (
          <NpcSprite
            key={character.id}
            npc={character}
            active={character.id === activeNpcId}
            onSelect={onSelectNpc}
          />
        ))}
      </Canvas>
    </section>
  );
}

function SparkScene({ splatUrl }: { splatUrl: string }) {
  const { gl, scene } = useThree();
  const sparkRef = useRef<SparkRenderer | null>(null);
  const splatRef = useRef<SplatMesh | null>(null);

  useEffect(() => {
    const spark = new SparkRenderer({
      renderer: gl,
      lodSplatScale: 1.1,
      sortRadial: true,
    });
    sparkRef.current = spark;
    scene.add(spark);

    return () => {
      scene.remove(spark);
      spark.dispose();
      sparkRef.current = null;
    };
  }, [gl, scene]);

  useEffect(() => {
    const splat = new SplatMesh({ url: splatUrl });
    splatRef.current = splat;
    scene.add(splat);

    return () => {
      scene.remove(splat);
      splat.dispose();
      splatRef.current = null;
    };
  }, [scene, splatUrl]);

  return null;
}

function GroundPlane() {
  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshBasicMaterial color="#170f0d" transparent opacity={0.32} />
      </mesh>
      <Html position={[0, 0.02, 0]} center>
        <div className="pointer-events-none h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(168,51,26,0.2),transparent_70%)]" />
      </Html>
    </group>
  );
}

function EntryCameraRig({
  introComplete,
  onComplete,
  pointerLocked,
}: {
  introComplete: boolean;
  onComplete: () => void;
  pointerLocked: boolean;
}) {
  const { camera } = useThree();
  const elapsedRef = useRef(0);
  const start = useMemo(() => new Vector3(0, 4.8, 10.5), []);
  const end = useMemo(() => new Vector3(0, PLAYER_HEIGHT, 5.4), []);
  const lookAt = useMemo(() => new Vector3(0, 1.35, 0), []);

  useFrame((_, delta) => {
    if (introComplete || pointerLocked) {
      if (!introComplete) {
        onComplete();
      }
      return;
    }

    elapsedRef.current = Math.min(3, elapsedRef.current + delta);
    const progress = MathUtils.smootherstep(elapsedRef.current / 3, 0, 1);

    camera.position.lerpVectors(start, end, progress);
    camera.lookAt(lookAt);

    if (progress >= 1) {
      onComplete();
    }
  });

  return null;
}

function WalkRig({
  introComplete,
  pointerLocked,
}: {
  introComplete: boolean;
  pointerLocked: boolean;
}) {
  const { camera } = useThree();
  const keysRef = useRef<MovementKeys>({
    backward: false,
    forward: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    function setKeyState(code: string, active: boolean) {
      if (code === "KeyW") {
        keysRef.current.forward = active;
      }
      if (code === "KeyS") {
        keysRef.current.backward = active;
      }
      if (code === "KeyA") {
        keysRef.current.left = active;
      }
      if (code === "KeyD") {
        keysRef.current.right = active;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      setKeyState(event.code, true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      setKeyState(event.code, false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!pointerLocked || !introComplete) {
      return;
    }

    const moveForward = Number(keysRef.current.forward) - Number(keysRef.current.backward);
    const moveRight = Number(keysRef.current.right) - Number(keysRef.current.left);
    if (moveForward === 0 && moveRight === 0) {
      return;
    }

    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new Vector3().crossVectors(forward, camera.up).normalize();

    const nextPosition = camera.position.clone();
    nextPosition.addScaledVector(forward, moveForward * delta * 2.7);
    nextPosition.addScaledVector(right, moveRight * delta * 2.7);
    nextPosition.y = PLAYER_HEIGHT;
    WALK_BOUNDS.clampPoint(nextPosition, nextPosition);

    camera.position.copy(nextPosition);
  });

  return null;
}
