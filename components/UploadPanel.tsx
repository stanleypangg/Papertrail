"use client";

import { FileUp, Sparkles } from "lucide-react";
import { useRef } from "react";

type UploadPanelProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onGenerate: () => void;
  onUseDemo: () => void;
  busy: boolean;
};

export function UploadPanel({ file, onFileChange, onGenerate, onUseDemo, busy }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="min-h-svh overflow-hidden bg-[#090b10] text-stone-50">
      <div className="relative min-h-svh px-5 py-6 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(93,183,255,0.24),transparent_32%),radial-gradient(circle_at_78%_18%,rgba(128,255,204,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_42%)]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#090b10] to-transparent" />

        <main className="relative mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col justify-between gap-10">
          <header className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="text-sm font-semibold tracking-[0.18em] text-cyan-100">PAGEWORLD</div>
            <button
              type="button"
              onClick={onUseDemo}
              disabled={busy}
              className="rounded-full border border-white/16 px-4 py-2 text-sm text-stone-200 transition hover:border-cyan-200/60 hover:text-white disabled:opacity-50"
            >
              Demo data
            </button>
          </header>

          <div className="grid items-end gap-10 lg:grid-cols-[1fr_410px]">
            <div className="max-w-3xl pb-2">
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-cyan-200/80">Interactive story space</p>
              <h1 className="max-w-4xl text-6xl font-semibold leading-[0.9] text-stone-50 sm:text-7xl lg:text-8xl">
                Walk inside a PDF.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-300 sm:text-xl">
                Upload a PDF and walk through its story as a chain of interactive 3D scenes.
              </p>
            </div>

            <div className="border border-white/12 bg-black/36 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="group flex min-h-48 w-full flex-col items-center justify-center gap-4 border border-dashed border-cyan-100/30 bg-white/[0.03] p-6 text-center transition hover:border-cyan-100/70 hover:bg-cyan-100/[0.06] disabled:opacity-50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-200 text-slate-950 shadow-lg shadow-cyan-400/20">
                  <FileUp size={22} />
                </span>
                <span className="text-base font-medium text-white">
                  {file ? file.name : "Choose a story PDF"}
                </span>
                <span className="max-w-xs text-sm leading-6 text-stone-400">
                  Fiction works best, but articles, biographies, and personal documents are supported.
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy || !file}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-cyan-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={18} />
                Generate world
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-4 text-sm text-stone-400 sm:grid-cols-3">
            <p>3 scenes max</p>
            <p>Source-grounded objects</p>
            <p>WASD + mouse look</p>
          </div>
        </main>
      </div>
    </section>
  );
}

