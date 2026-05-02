"use client";

import { Text, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Box3, Mesh, Vector3, type Group } from "three";

import type { GeneratedObjectModel } from "@/lib/objectModels";
import type { ObjectPlacement } from "@/lib/sceneMapping";
import type { WorldTarget } from "@/lib/sceneNavigation";
import type { SceneObject } from "@/lib/sceneSchema";

type PrimitiveObjectProps = {
  object: SceneObject;
  model?: GeneratedObjectModel;
  placement: ObjectPlacement;
  accent: string;
  targeted: boolean;
  onSelect: () => void;
};

export function PrimitiveObject({ object, model, placement, accent, targeted, onSelect }: PrimitiveObjectProps) {
  const groupRef = useRef<Group | null>(null);
  const [hovered, setHovered] = useState(false);
  const scale = placement.scale ?? 1;
  const highlighted = hovered || targeted;
  const target: WorldTarget = { type: "object", id: object.id };
  const modelUrl = model?.status === "succeeded" ? model.modelUrl : null;
  const primitiveGeometry = <ObjectGeometry object={object} accent={accent} hovered={highlighted} />;

  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  useEffect(() => {
    if (modelUrl) {
      useGLTF.preload(modelUrl);
    }
  }, [modelUrl]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y =
      placement.position[1] + Math.sin(state.clock.elapsedTime * 1.8 + placement.position[0]) * 0.035;
  });

  return (
    <group
      ref={groupRef}
      userData={{ worldTarget: target }}
      position={placement.position}
      rotation={placement.rotation}
      scale={highlighted ? scale * 1.08 : scale}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[1.35, 1.55, 1.35]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {modelUrl ? (
        <ModelErrorBoundary key={modelUrl} fallback={primitiveGeometry}>
          <Suspense fallback={primitiveGeometry}>
            <GeneratedModel url={modelUrl} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        primitiveGeometry
      )}
      <pointLight color={accent} intensity={highlighted ? 1.2 : 0.65} distance={3.2} />
      <Text position={[0, 0.78, 0]} fontSize={0.14} maxWidth={1.7} textAlign="center" color="#f8fbff">
        {object.label}
      </Text>
    </group>
  );
}

class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function GeneratedModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const normalized = useMemo(() => {
    const scene = gltf.scene.clone(true);

    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new Box3().setFromObject(scene);

    if (box.isEmpty()) {
      return { scene, fitScale: 1, position: [0, 0, 0] as [number, number, number] };
    }

    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const fitScale = 0.9 / maxDimension;
    const position: [number, number, number] = [
      -center.x * fitScale,
      -box.min.y * fitScale,
      -center.z * fitScale
    ];

    return { scene, fitScale, position };
  }, [gltf.scene]);

  return <primitive object={normalized.scene} position={normalized.position} scale={normalized.fitScale} />;
}

function ObjectGeometry({ object, accent, hovered }: { object: SceneObject; accent: string; hovered: boolean }) {
  const emissiveIntensity = hovered ? 0.75 : 0.35;

  if (object.visualType === "book") {
    return (
      <group>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.14, 0.55]} />
          <meshStandardMaterial color="#4d2e2a" emissive={accent} emissiveIntensity={emissiveIntensity} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.72, 0.035, 0.5]} />
          <meshStandardMaterial color="#efe4c8" roughness={0.85} />
        </mesh>
      </group>
    );
  }

  if (object.visualType === "letter" || object.visualType === "sign" || object.visualType === "portrait") {
    return (
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.52, 0.045]} />
        <meshStandardMaterial color={object.visualType === "portrait" ? "#263342" : "#d8c8a6"} emissive={accent} emissiveIntensity={emissiveIntensity} />
      </mesh>
    );
  }

  if (object.visualType === "clock") {
    return (
      <group>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.08, 32]} />
          <meshStandardMaterial color="#d7c18b" emissive={accent} emissiveIntensity={emissiveIntensity} />
        </mesh>
        <mesh position={[0, 0, 0.08]} rotation={[0, 0, 0.8]}>
          <boxGeometry args={[0.035, 0.24, 0.03]} />
          <meshStandardMaterial color="#1b1d21" />
        </mesh>
        <mesh position={[0, 0, 0.09]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.03, 0.17, 0.03]} />
          <meshStandardMaterial color="#1b1d21" />
        </mesh>
      </group>
    );
  }

  if (object.visualType === "key") {
    return (
      <group>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.035, 10, 28]} />
          <meshStandardMaterial color="#c7a24d" emissive={accent} emissiveIntensity={emissiveIntensity} />
        </mesh>
        <mesh castShadow position={[0.34, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.55, 12]} />
          <meshStandardMaterial color="#c7a24d" emissive={accent} emissiveIntensity={emissiveIntensity} />
        </mesh>
      </group>
    );
  }

  if (object.visualType === "lamp") {
    return (
      <group>
        <mesh castShadow position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.5, 14]} />
          <meshStandardMaterial color="#39434f" />
        </mesh>
        <mesh castShadow position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.24, 20, 20]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.3} />
        </mesh>
      </group>
    );
  }

  if (object.visualType === "tree") {
    return (
      <group>
        <mesh castShadow position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.07, 0.12, 0.55, 8]} />
          <meshStandardMaterial color="#3a281c" />
        </mesh>
        <mesh castShadow position={[0, 0.22, 0]}>
          <coneGeometry args={[0.34, 0.8, 12]} />
          <meshStandardMaterial color="#2c5d4c" emissive={accent} emissiveIntensity={emissiveIntensity} />
        </mesh>
      </group>
    );
  }

  if (object.visualType === "door") {
    return (
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.9, 0.08]} />
        <meshStandardMaterial color="#293848" emissive={accent} emissiveIntensity={emissiveIntensity} />
      </mesh>
    );
  }

  if (object.visualType === "memory_orb") {
    return (
      <mesh castShadow>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} transparent opacity={0.78} />
      </mesh>
    );
  }

  return (
    <mesh castShadow>
      <dodecahedronGeometry args={[0.36, 0]} />
      <meshStandardMaterial color="#d6dee8" emissive={accent} emissiveIntensity={emissiveIntensity} roughness={0.45} />
    </mesh>
  );
}
