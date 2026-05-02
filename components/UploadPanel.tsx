"use client";

import { FileUp, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

type UploadPanelProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onGenerate: () => void;
  busy: boolean;
};

export function UploadPanel({ file, onFileChange, onGenerate, busy }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="relative min-h-svh overflow-hidden bg-[#e8ded0] text-[#171715]">
      <Image
        src="/landing/papertrail-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover object-[58%_50%]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(244,237,224,0.78)_0%,rgba(244,237,224,0.52)_40%,rgba(244,237,224,0.2)_68%,rgba(30,28,24,0.1)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(255,248,237,0.68),rgba(255,248,237,0.26)_34%,transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52svh] bg-gradient-to-t from-[#d77954]/62 via-[#d77954]/18 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#fff8ee]/55 to-transparent" />

      <main className="relative z-10 min-h-svh px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="absolute left-1/2 top-[47%] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-xs font-bold uppercase text-[#4d4038]">From page to place</p>
          <p className="mx-auto mt-4 max-w-[36rem] text-balance text-2xl font-semibold leading-[1.08] text-[#171715] sm:text-4xl">
            Upload a PDF and turn it into a walkable 3D story.
          </p>
          <p className="mx-auto mt-4 max-w-[31rem] text-sm leading-6 text-[#4f463f] sm:text-base">
            3 scenes max. Source-grounded objects. WASD and mouse look.
          </p>
          <Link
            href="/join"
            className="mt-5 inline-flex min-h-10 items-center justify-center border border-[#171715]/18 bg-[#fff8ed]/42 px-4 text-sm font-semibold text-[#171715] transition hover:bg-[#fff8ed]/75 focus:outline-none focus:ring-2 focus:ring-[#171715]/35"
          >
            Join with headset code
          </Link>

          <div className="mx-auto mt-8 flex w-full max-w-[43rem] flex-col gap-3 border-t border-[#171715]/18 pt-4 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 border border-[#171715]/18 bg-[#fff8ed]/48 px-4 text-sm font-semibold text-[#171715] transition hover:bg-[#fff8ed]/75 focus:outline-none focus:ring-2 focus:ring-[#171715]/35 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#171715] px-6 text-sm font-semibold text-[#f8f3ea] transition hover:bg-[#2c2924] focus:outline-none focus:ring-2 focus:ring-[#171715]/35 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles size={18} aria-hidden="true" />
              Generate world
            </button>
          </div>
        </div>

        <h1 className="pointer-events-none absolute inset-x-0 bottom-[clamp(1.25rem,3vw,3rem)] select-none text-center text-[clamp(4.7rem,16vw,16rem)] font-black leading-none tracking-normal text-[#171715] sm:text-[clamp(7rem,16vw,16rem)]">
          Papertrail
        </h1>
      </main>
    </section>
  );
}
