"use client";

import { ArrowLeft, Wand2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { DEMO_NPCS } from "@/lib/demoNpcs";

type DemoCharacterSelectProps = {
  onConfirm: (npcId: string) => void;
  onBack: () => void;
};

export function DemoCharacterSelect({ onConfirm, onBack }: DemoCharacterSelectProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = DEMO_NPCS.find((npc) => npc.id === selectedId) ?? null;

  return (
    <main className="min-h-svh w-screen overflow-y-auto bg-[#0a0908] px-6 py-10 text-stone-50 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">
              Choose your character
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
              Who walks the castle tonight?
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-300">
              Pick the wizard you&apos;ll role-play. Everyone else will be wandering the
              world, ready to chat when you walk up to them.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 border border-white/14 bg-black/40 px-4 py-2 text-sm transition hover:border-cyan-200/60"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {DEMO_NPCS.map((npc) => {
            const isSelected = npc.id === selectedId;
            return (
              <button
                key={npc.id}
                type="button"
                onClick={() => setSelectedId(npc.id)}
                aria-pressed={isSelected}
                className={`group flex flex-col overflow-hidden border bg-[#100b0a] text-left transition-all ${
                  isSelected
                    ? "border-cyan-200 shadow-[0_0_0_1px_rgba(165,243,252,0.6),0_24px_60px_rgba(0,0,0,0.55)]"
                    : "border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.35)] hover:-translate-y-1 hover:border-white/30"
                }`}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <Image
                    src={npc.portrait}
                    alt={npc.name}
                    fill
                    sizes="(min-width: 1024px) 18vw, 45vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,7,6,0.05),rgba(11,7,6,0.85))]" />
                </div>
                <div className="px-3 py-3">
                  <p className="text-[0.62rem] uppercase tracking-[0.24em] text-cyan-200/80">
                    {npc.role}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-tight">{npc.name}</p>
                </div>
              </button>
            );
          })}
        </div>

        <footer className="flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[3rem] text-sm text-stone-300">
            {selected ? (
              <>
                <span className="text-cyan-200/85">Playing as {selected.name}.</span>
                <span className="ml-2 text-stone-400">{selected.tagline}</span>
              </>
            ) : (
              <span className="text-stone-400">Select a character to continue.</span>
            )}
          </div>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected.id)}
            className="inline-flex items-center gap-2 border border-cyan-200/40 bg-cyan-200 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-white/10 disabled:text-stone-500"
          >
            <Wand2 size={16} />
            Enter the world
          </button>
        </footer>
      </div>
    </main>
  );
}
