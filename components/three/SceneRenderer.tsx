"use client";

import { Stars } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { Component, Suspense, type ReactNode } from "react";
import { BackSide, TextureLoader } from "three";

import { LayoutRenderer } from "@/components/three/LayoutRenderer";
import { Portal } from "@/components/three/objects/Portal";
import { PrimitiveObject } from "@/components/three/objects/PrimitiveObject";
import { layoutSpecs } from "@/lib/layoutSpecs";
import type { LayoutType } from "@/lib/sceneSchema";
import type { SceneObjectModelMap } from "@/lib/objectModels";
import type { MoodStyle, ObjectPlacement } from "@/lib/sceneMapping";
import { getPlacement, moodStyles } from "@/lib/sceneMapping";
import { targetKey, type WorldTarget } from "@/lib/sceneNavigation";
import type { SceneObject, ScenePlan } from "@/lib/sceneSchema";

type SceneImagePresentation = "mural" | "panorama";

type SceneRendererProps = {
  scene: ScenePlan;
  sceneImageUrl: string | null;
  sceneImagePresentation?: SceneImagePresentation;
  objectModels: SceneObjectModelMap[string];
  targetedTarget: WorldTarget | null;
  onSelectObject: (object: SceneObject) => void;
  onPortalClick: () => void;
};

export function SceneRenderer({
  scene,
  sceneImageUrl,
  sceneImagePresentation = "mural",
  objectModels,
  targetedTarget,
  onSelectObject,
  onPortalClick
}: SceneRendererProps) {
  const style = moodStyles[scene.mood];
  const targetedKey = targetKey(targetedTarget);
  const hasPanorama = Boolean(sceneImageUrl && sceneImagePresentation === "panorama");

  return (
    <>
      <color attach="background" args={[style.background]} />
      {hasPanorama ? null : <fog attach="fog" args={[style.fog, style.fogNear, style.fogFar * 1.25]} />}
      <ambientLight color={style.ambient} intensity={style.ambientIntensity} />
      <directionalLight position={[4, 7, 4]} intensity={1.4} color={style.key} castShadow />
      <pointLight position={[0, 2.7, -1.6]} intensity={1.1} color={style.accent} distance={8} />

      {hasPanorama && sceneImageUrl ? (
        <SceneImageErrorBoundary key={`${scene.id}:${sceneImageUrl}:panorama`} fallback={<PanoramaPlaceholder color={style.background} />}>
          <Suspense fallback={<PanoramaPlaceholder color={style.background} />}>
            <PanoramaEnvironment imageUrl={sceneImageUrl} />
          </Suspense>
        </SceneImageErrorBoundary>
      ) : (
        <>
          <WorldAtmosphere mood={scene.mood} style={style} />
          <LayoutRenderer layoutType={scene.layoutType} style={style} dressing={scene.dressing} />
          {sceneImageUrl ? (
            <SceneImageErrorBoundary key={`${scene.id}:${sceneImageUrl}:mural`} fallback={<SceneMuralFallback layoutType={scene.layoutType} style={style} />}>
              <Suspense fallback={<SceneMuralFallback layoutType={scene.layoutType} style={style} />}>
                <SceneMural imageUrl={sceneImageUrl} layoutType={scene.layoutType} style={style} />
              </Suspense>
            </SceneImageErrorBoundary>
          ) : null}
          <DepthSetDressing layoutType={scene.layoutType} style={style} />
        </>
      )}
      {hasPanorama ? <PanoramaFloor accent={style.accent} /> : null}
      {scene.objects.map((object, index) => (
        <PrimitiveObject
          key={object.id}
          object={object}
          model={objectModels[object.id]}
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

function WorldAtmosphere({ mood, style }: { mood: ScenePlan["mood"]; style: MoodStyle }) {
  return (
    <group>
      <mesh position={[0, 22, 0]}>
        <sphereGeometry args={[70, 48, 24]} />
        <meshBasicMaterial color={style.background} fog side={BackSide} depthWrite={false} />
      </mesh>
      <Stars radius={48} depth={14} count={mood === "wonder" ? 260 : 90} factor={2.1} fade speed={0.18} />
    </group>
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

function SceneMural({ imageUrl, layoutType, style }: { imageUrl: string; layoutType: LayoutType; style: MoodStyle }) {
  const texture = useLoader(TextureLoader, imageUrl);
  const placement = getMuralPlacement(layoutType);

  return (
    <group position={placement.position} rotation={placement.rotation}>
      <mesh position={[0, 0, -0.035]} receiveShadow>
        <boxGeometry args={[placement.size[0] + 0.28, placement.size[1] + 0.28, 0.08]} />
        <meshStandardMaterial color={style.wall} roughness={0.82} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0, 0.015]}>
        <planeGeometry args={placement.size} />
        <meshBasicMaterial map={texture} toneMapped={false} fog transparent opacity={0.92} />
      </mesh>
    </group>
  );
}

function SceneMuralFallback({ layoutType, style }: { layoutType: LayoutType; style: MoodStyle }) {
  const placement = getMuralPlacement(layoutType);

  return (
    <group position={placement.position} rotation={placement.rotation}>
      <mesh position={[0, 0, -0.035]} receiveShadow>
        <boxGeometry args={[placement.size[0] + 0.28, placement.size[1] + 0.28, 0.08]} />
        <meshStandardMaterial color={style.wall} roughness={0.82} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0, 0.015]}>
        <planeGeometry args={placement.size} />
        <meshStandardMaterial color={style.background} emissive={style.accent} emissiveIntensity={0.16} roughness={0.9} />
      </mesh>
    </group>
  );
}

class SceneImageErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
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

function getMuralPlacement(layoutType: LayoutType): { position: [number, number, number]; rotation?: [number, number, number]; size: [number, number] } {
  return layoutSpecs[layoutType].depth.mural;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function DepthSetDressing({ layoutType, style }: { layoutType: LayoutType; style: MoodStyle }) {
  const depth = layoutSpecs[layoutType].depth;

  if (layoutType === "corridor_path") {
    return (
      <group>
        {[depth.midgroundZ - 3.4, depth.midgroundZ - 1, depth.midgroundZ + 1.4, depth.farZ + 2.1, depth.farZ + 4.3].map((z, index) => (
          <group key={z} position={[0, 0, z]}>
            <mesh receiveShadow position={[-2.25, 1.7, 0]}>
              <boxGeometry args={[0.12, 3.4, 1.6]} />
              <meshStandardMaterial color={style.wall} roughness={0.86} transparent opacity={0.48} depthWrite={false} />
            </mesh>
            <mesh receiveShadow position={[2.25, 1.7, 0]}>
              <boxGeometry args={[0.12, 3.4, 1.6]} />
              <meshStandardMaterial color={style.wall} roughness={0.86} transparent opacity={0.48} depthWrite={false} />
            </mesh>
            <pointLight position={[0, 2.4, -0.15]} intensity={0.22} color={index % 2 === 0 ? style.accent : style.key} distance={4.5} />
          </group>
        ))}
        <mesh position={[0, 1.85, depth.farZ + 0.06]}>
          <planeGeometry args={[4.4, 2.8]} />
          <meshBasicMaterial color={style.accent} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  if (layoutType === "open_clearing") {
    return (
      <group>
        {[depth.midgroundZ, depth.midgroundZ - 1.6, depth.farZ + 0.3].map((z, index) => (
          <group key={z} position={[(index - 1) * 2.7, 0, z]}>
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.5, 0.4, 0.9]} />
              <meshStandardMaterial color={style.wall} roughness={0.94} transparent opacity={0.6} />
            </mesh>
            <mesh position={[0.35, 1.3, -0.12]} castShadow>
              <cylinderGeometry args={[0.08, 0.13, 2.2, 8]} />
              <meshStandardMaterial color="#241d18" roughness={0.9} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.35, depth.farZ + 0.08]}>
          <planeGeometry args={[8.6, 2.5]} />
          <meshBasicMaterial color={style.accent} transparent opacity={0.08} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      {[depth.foregroundZ, depth.foregroundZ - 2.1, depth.midgroundZ, depth.farZ + 2.1].map((z, index) => (
        <mesh key={z} position={[(index - 1) * 3.1, 1.05, z]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 2.1, 0.42]} />
          <meshStandardMaterial color={index % 2 === 0 ? style.wall : style.floor} roughness={0.82} transparent opacity={0.72} />
        </mesh>
      ))}
      <mesh position={[0, 1.7, depth.farZ + 0.08]}>
        <planeGeometry args={[8.2, 2.8]} />
        <meshBasicMaterial color={style.accent} transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}
