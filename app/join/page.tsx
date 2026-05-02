"use client";

import { ArrowRight, Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (!normalized) {
      return;
    }

    router.push(`/world/${encodeURIComponent(normalized)}`);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#080a0f] px-5 py-8 text-stone-50">
      <section className="w-full max-w-xl border border-cyan-200/20 bg-cyan-200/[0.045] p-5 sm:p-7">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">PageWorld headset join</p>
        <h1 className="mt-3 text-3xl font-semibold">Enter the desktop code</h1>
        <p className="mt-3 text-sm leading-6 text-stone-300">
          Use the short code shown on the generated scene screen. The local dev server and ngrok tunnel must stay running.
        </p>

        <form onSubmit={submitCode} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={8}
            placeholder="ABCDE"
            className="min-h-14 flex-1 border border-white/14 bg-black/35 px-4 font-mono text-2xl font-bold uppercase tracking-[0.16em] text-cyan-50 outline-none transition placeholder:text-stone-600 focus:border-cyan-100"
          />
          <button
            type="submit"
            className="inline-flex min-h-14 items-center justify-center gap-2 bg-cyan-200 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
          >
            Join
            <ArrowRight size={17} />
          </button>
        </form>

        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-300 transition hover:text-cyan-100"
        >
          <Home size={16} />
          Home
        </Link>
      </section>
    </main>
  );
}
