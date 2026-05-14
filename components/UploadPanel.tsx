"use client";

import { FileUp, Play, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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
    <section className="relative min-h-svh overflow-hidden bg-[#0b0d11] text-[#f8f3ea]">
      <Image
        src="/landing/papertrail-saas-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover object-[50%_45%]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,9,13,0.16)_0%,rgba(7,9,13,0.34)_42%,rgba(7,9,13,0.82)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,244,219,0.22),rgba(255,244,219,0.08)_27%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,9,13,0.58)_0%,rgba(7,9,13,0.2)_42%,rgba(7,9,13,0.5)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/35 to-transparent" />

      <main className="relative z-10 min-h-svh px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="absolute left-1/2 top-[47%] w-[min(58rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-xs font-bold uppercase text-[#f4d7a4]">From page to place</p>
          <p className="mx-auto mt-4 max-w-[36rem] text-balance text-2xl font-semibold leading-[1.08] text-[#fff8ec] sm:text-4xl">
            Upload a PDF and turn it into a walkable 3D story.
          </p>
          <Link
            href="/join"
            className="mt-5 inline-flex min-h-10 items-center justify-center border border-[#fff8ec]/20 bg-[#fff8ec]/10 px-4 text-sm font-semibold text-[#fff8ec] transition hover:bg-[#fff8ec]/18 focus:outline-none focus:ring-2 focus:ring-[#f4d7a4]/45"
          >
            Join with headset code
          </Link>

          <div className="mx-auto mt-8 grid w-full max-w-[52rem] gap-3 border-t border-[#fff8ec]/18 pt-4 text-left md:grid-cols-[0.85fr_1.15fr]">
            <section className="border border-[#f4d7a4]/35 bg-[#f4d7a4]/12 p-4">
              <p className="text-xs font-bold uppercase text-[#f4d7a4]">Demo path</p>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[#fff8ec]/82">
                Jump straight into the prepared story world with cached scenes, narration, and characters.
              </p>
              <button
                type="button"
                onClick={onUseDemo}
                disabled={busy}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#f4d7a4] px-5 text-sm font-semibold text-[#171715] transition hover:bg-[#ffe2ad] focus:outline-none focus:ring-2 focus:ring-[#f4d7a4]/45 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play size={18} aria-hidden="true" />
                Start demo
              </button>
            </section>

            <section className="border border-[#fff8ec]/20 bg-[#fff8ec]/10 p-4">
              <p className="text-xs font-bold uppercase text-[#fff8ec]/78">Non-demo path</p>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[#fff8ec]/78">
                Upload your own PDF, generate scenes from its text, then enter the resulting world.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 border border-[#fff8ec]/22 bg-[#0b0d11]/42 px-4 text-sm font-semibold text-[#fff8ec] transition hover:bg-[#fff8ec]/14 focus:outline-none focus:ring-2 focus:ring-[#f4d7a4]/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileUp size={18} aria-hidden="true" />
                  <span className="min-w-0 truncate">{file ? file.name : "Choose PDF"}</span>
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
                  className="inline-flex min-h-12 items-center justify-center gap-2 border border-[#f4d7a4]/70 px-5 text-sm font-semibold text-[#f4d7a4] transition hover:bg-[#f4d7a4]/12 focus:outline-none focus:ring-2 focus:ring-[#f4d7a4]/45 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Sparkles size={18} aria-hidden="true" />
                  Generate from PDF
                </button>
              </div>
            </section>
          </div>
        </div>

        <h1 className="pointer-events-none absolute inset-x-0 bottom-[clamp(1.25rem,3vw,3rem)] select-none text-center text-[clamp(4.7rem,16vw,16rem)] font-black leading-none tracking-normal text-[#fff4dd] drop-shadow-[0_12px_34px_rgba(0,0,0,0.6)] sm:text-[clamp(7rem,16vw,16rem)]">
          Papertrail
        </h1>
      </main>
    </section>
  );
}
