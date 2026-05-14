"use client";

import { ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { DemoNpc } from "@/lib/demoNpcs";

type DemoNpcDialogProps = {
  npc: DemoNpc;
  onClose: () => void;
};

export function DemoNpcDialog({ npc, onClose }: DemoNpcDialogProps) {
  const [lineIndex, setLineIndex] = useState(0);

  const isLast = lineIndex >= npc.lines.length - 1;

  const advance = useCallback(() => {
    if (isLast) {
      onClose();
      return;
    }
    setLineIndex((idx) => idx + 1);
  }, [isLast, onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.code === "Space" || event.code === "Enter" || event.code === "KeyE") {
        event.preventDefault();
        advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-8">
      <div className="pointer-events-auto w-full max-w-2xl border border-cyan-200/30 bg-[#070b10]/95 p-6 text-stone-100 shadow-2xl shadow-black/60 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">{npc.role}</p>
            <h2 className="mt-1 text-2xl font-semibold">{npc.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close conversation with ${npc.name}`}
            className="inline-flex size-9 items-center justify-center border border-white/15 text-stone-200 transition hover:border-cyan-200/60"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-4 text-base leading-7 text-stone-100">
          &ldquo;{npc.lines[lineIndex]}&rdquo;
        </p>

        <div className="mt-5 flex items-center justify-between gap-4 text-xs text-stone-400">
          <span>
            {lineIndex + 1} / {npc.lines.length}
          </span>
          <button
            type="button"
            onClick={advance}
            className="inline-flex items-center gap-2 border border-cyan-200/40 bg-cyan-200 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-100"
          >
            {isLast ? "Step back" : "Continue"}
            <ChevronRight size={14} />
          </button>
        </div>

        <p className="mt-3 text-[0.7rem] uppercase tracking-[0.18em] text-stone-500">
          Space / Enter / E to advance · Esc to leave
        </p>
      </div>
    </div>
  );
}
