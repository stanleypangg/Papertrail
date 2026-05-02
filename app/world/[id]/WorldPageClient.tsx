"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LoadingState } from "@/components/LoadingState";
import { DEMO_SPLAT_MANIFEST_URL, emptySceneSplatMap, sceneSplatsFromManifest, type DemoSplatManifest, type SceneSplatMap } from "@/lib/demoSplats";
import type { StoredWorld } from "@/lib/worldSchema";

const WorldViewer = dynamic(() => import("@/components/WorldViewer").then((module) => module.WorldViewer), {
  ssr: false,
  loading: () => <LoadingState label="Opening the shared world" />
});

type WorldPageClientProps = {
  worldId: string;
};

type WorldResponse = {
  world?: StoredWorld;
  error?: string;
};

export function WorldPageClient({ worldId }: WorldPageClientProps) {
  const [world, setWorld] = useState<StoredWorld | null>(null);
  const [sceneSplats, setSceneSplats] = useState<SceneSplatMap>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWorld() {
      try {
        const response = await fetch(`/api/worlds/${encodeURIComponent(worldId)}`, { cache: "no-store" });
        const body = (await response.json()) as WorldResponse;

        if (!response.ok || !body.world) {
          throw new Error(body.error ?? "The shared world could not be loaded.");
        }

        if (active) {
          setWorld(body.world);
          setError("");
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "The shared world could not be loaded.");
        }
      }
    }

    loadWorld();

    return () => {
      active = false;
    };
  }, [worldId]);

  useEffect(() => {
    if (!world) {
      return;
    }

    let active = true;

    fetch(DEMO_SPLAT_MANIFEST_URL, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<DemoSplatManifest> : null)
      .then((manifest) => {
        if (active) {
          setSceneSplats(sceneSplatsFromManifest(world.scenes, manifest));
        }
      })
      .catch(() => {
        if (active) {
          setSceneSplats(emptySceneSplatMap(world.scenes));
        }
      });

    return () => {
      active = false;
    };
  }, [world]);

  if (error) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#090b10] px-6 text-stone-50">
        <div className="w-full max-w-lg border border-white/12 bg-white/[0.03] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-rose-200">Shared world unavailable</p>
          <h1 className="mt-3 text-3xl font-semibold">This temporary link is not active.</h1>
          <p className="mt-4 text-sm leading-6 text-stone-300">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-flex bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Home
          </Link>
        </div>
      </main>
    );
  }

  if (!world) {
    return <LoadingState label="Opening the shared world" />;
  }

  return (
    <WorldViewer
      scenes={world.scenes}
      sceneImages={world.sceneImages}
      sceneSplats={sceneSplats}
      objectModels={world.objectModels}
      onExit={() => {
        window.location.href = "/";
      }}
      exitLabel="Home"
    />
  );
}
