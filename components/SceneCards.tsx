"use client";

import { DoorOpen, ImageIcon } from "lucide-react";

import type { ScenePlan } from "@/lib/sceneSchema";

type SceneImageMap = Record<string, string | null>;

type SceneCardsProps = {
  scenes: ScenePlan[];
  images: SceneImageMap;
  source: string;
  warnings: string[];
  onEnterWorld: () => void;
  onReset: () => void;
};

export function SceneCards({ scenes, images, source, warnings, onEnterWorld, onReset }: SceneCardsProps) {
  return (
    <section className="min-h-svh bg-[#080a0f] px-5 py-6 text-stone-50 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-7xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">Generated with {source}</p>
            <h1 className="mt-2 text-3xl font-semibold">Scene chain</h1>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onReset} className="border border-white/14 px-4 py-2 text-sm text-stone-200">
              New PDF
            </button>
            <button
              type="button"
              onClick={onEnterWorld}
              className="inline-flex items-center gap-2 bg-cyan-200 px-5 py-2 text-sm font-semibold text-slate-950"
            >
              <DoorOpen size={17} />
              Enter world
            </button>
          </div>
        </header>

        {warnings.length > 0 ? (
          <div className="mt-4 border border-amber-200/20 bg-amber-200/8 p-3 text-sm leading-6 text-amber-100">
            {warnings.join(" ")}
          </div>
        ) : null}

        <div className="grid flex-1 items-stretch gap-4 py-6 lg:grid-cols-3">
          {scenes.map((scene, index) => (
            <article key={scene.id} className="flex min-h-[560px] flex-col border border-white/12 bg-white/[0.035]">
              <div className="relative h-52 overflow-hidden bg-[#111820]">
                {images[scene.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[scene.id] ?? ""} alt="" className="h-full w-full object-cover opacity-90" />
                ) : (
                  <div className="flex h-full items-center justify-center text-cyan-100/70">
                    <ImageIcon size={32} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-transparent to-transparent" />
                <span className="absolute left-4 top-4 bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                  Scene {index + 1}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-2xl font-semibold">{scene.title}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-300">{scene.summary}</p>
                <dl className="mt-5 grid gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Layout</dt>
                    <dd className="mt-1 text-stone-200">{humanizeLayout(scene.layoutType)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Dressing</dt>
                    <dd className="mt-1 leading-6 text-stone-300">{scene.dressing}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Interactables</p>
                  <p className="mt-2 text-sm text-stone-300">{scene.objects.map((object) => object.label).join(" · ")}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function humanizeLayout(layoutType: ScenePlan["layoutType"]): string {
  const labels: Record<ScenePlan["layoutType"], string> = {
    interior_room: "Interior room",
    open_clearing: "Open clearing",
    corridor_path: "Corridor path",
    exhibit_space: "Exhibit space"
  };

  return labels[layoutType];
}
