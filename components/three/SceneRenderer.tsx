"use client";

import { Stars } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { Suspense } from "react";
import { BackSide, TextureLoader } from "three";

import { LayoutRenderer } from "@/components/three/LayoutRenderer";
import { Portal } from "@/components/three/objects/Portal";
import { PrimitiveObject } from "@/components/three/objects/PrimitiveObject";
import type { ObjectPlacement } from "@/lib/sceneMapping";
import { getPlacement, moodStyles } from "@/lib/sceneMapping";
import { targetKey, type WorldTarget } from "@/lib/sceneNavigation";
import type { SceneObject, ScenePlan } from "@/lib/sceneSchema";

type SceneRendererProps = {
  scene: ScenePlan;
  sceneImageUrl: string | null;
  targetedTarget: WorldTarget | null;
  onSelectObject: (object: SceneObject) => void;
  onPortalClick: () => void;
};

export function SceneRenderer({ scene, sceneImageUrl, targetedTarget, onSelectObject, onPortalClick }: SceneRendererProps) {
  const style = moodStyles[scene.mood];
  const targetedKey = targetKey(targetedTarget);
  const hasPanorama = Boolean(sceneImageUrl);

  return (
    <>
      <color attach="background" args={[style.background]} />
      {hasPanorama ? null : <fog attach="fog" args={[style.fog, style.fogNear, style.fogFar]} />}
      <ambientLight color={style.ambient} intensity={style.ambientIntensity} />
      <directionalLight position={[4, 7, 4]} intensity={1.4} color={style.key} castShadow />
      <pointLight position={[0, 2.7, -1.6]} intensity={1.1} color={style.accent} distance={8} />

      {sceneImageUrl ? (
        <Suspense fallback={<PanoramaPlaceholder color={style.background} />}>
          <PanoramaEnvironment imageUrl={sceneImageUrl} />
        </Suspense>
      ) : (
        <>
          <Stars radius={45} depth={16} count={scene.mood === "wonder" ? 220 : 80} factor={2.2} fade speed={0.25} />
          <LayoutRenderer layoutType={scene.layoutType} style={style} dressing={scene.dressing} />
        </>
      )}
      {hasPanorama ? <PanoramaFloor accent={style.accent} /> : null}
      {scene.objects.map((object, index) => (
        <PrimitiveObject
          key={object.id}
          object={object}
          placement={hasPanorama ? getPanoramaPlacement(object, index) : getPlacement(scene.layoutType, object, index)}
          accent={style.accent}
          targeted={targetedKey === `object:${object.id}`}
          onSelect={() => onSelectObject(object)}
        />
      ))}
      <Portal
        scene={scene}
        accent={style.accent}
        targeted={targetedKey === "portal"}
        placement={hasPanorama ? getPanoramaPortalPlacement() : undefined}
        onClick={onPortalClick}
      />
    </>
  );
}

function PanoramaEnvironment({ imageUrl }: { imageUrl: string }) {
  const texture = useLoader(TextureLoader, imageUrl);

  return (
    <mesh rotation={[0, Math.PI / 2, 0]}>
      <sphereGeometry args={[70, 96, 48]} />
      <meshBasicMaterial map={texture} toneMapped={false} side={BackSide} />
    </mesh>
  );
}

function PanoramaPlaceholder({ color }: { color: string }) {
  return (
    <mesh>
      <sphereGeometry args={[70, 64, 32]} />
      <meshBasicMaterial color={color} side={BackSide} />
    </mesh>
  );
}

function PanoramaFloor({ accent }: { accent: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
      <circleGeometry args={[4.8, 64]} />
      <meshBasicMaterial color={accent} transparent opacity={0.08} depthWrite={false} />
    </mesh>
  );
}

function getPanoramaPlacement(object: SceneObject, index: number): ObjectPlacement {
  const slotAngles: Partial<Record<SceneObject["slot"], number>> = {
    center: 0,
    table: 0,
    wall: 0,
    left: -48,
    right: 48,
    back: 180,
    floor: [-28, 22, 68][index] ?? 0
  };
  const angle = degreesToRadians(slotAngles[object.slot] ?? [-42, 0, 42][index] ?? 0);
  const radius = 3.35;

  return {
    position: [Math.sin(angle) * radius, 1.18, -Math.cos(angle) * radius],
    rotation: [0, -angle, 0],
    scale: 1.05
  };
}

function getPanoramaPortalPlacement(): ObjectPlacement {
  const angle = degreesToRadians(135);
  const radius = 4;

  return {
    position: [Math.sin(angle) * radius, 0, -Math.cos(angle) * radius],
    rotation: [0, -angle, 0],
    scale: 0.78
  };
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
