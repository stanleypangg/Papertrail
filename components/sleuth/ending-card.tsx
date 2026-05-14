"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface EndingCardProps {
  endingId: string;
  narration: string;
  score: number;
  scriptId: string;
  title: string;
}

export function EndingCard({
  endingId,
  narration,
  score,
  scriptId,
  title,
}: EndingCardProps) {
  const [visibleCharacters, setVisibleCharacters] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setVisibleCharacters((current) => {
        if (current >= narration.length) {
          window.clearInterval(intervalId);
          return current;
        }
        return Math.min(narration.length, current + 4);
      });
    }, 28);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [narration]);

  const revealedNarration = narration.slice(0, visibleCharacters) || " ";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(168,51,26,0.18),transparent_30%),linear-gradient(180deg,#140d0c_0%,#0d0908_100%)] px-5 py-8 text-[#f5ecde] sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-full max-w-[88rem] flex-col justify-between gap-10 border border-white/10 bg-black/20 p-6 shadow-[0_30px_140px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:p-8 lg:p-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.74rem] uppercase tracking-[0.38em] text-[#b88f6b]">
              Verdict
            </div>
            <h1 className="mt-4 text-[3.2rem] leading-[0.88] text-[#a8331a] sm:text-[4.4rem]">
              {title}
            </h1>
            <p className="mt-4 text-sm uppercase tracking-[0.3em] text-[#c9b49f]">
              {endingId.replaceAll("_", " ")}
            </p>
          </div>
          <div className="border border-white/12 bg-[#110c0b] px-4 py-3 text-right">
            <div className="text-[0.68rem] uppercase tracking-[0.3em] text-[#b88f6b]">
              Score
            </div>
            <div className="mt-2 font-mono text-3xl text-[#f6ecdb]">{score}</div>
          </div>
        </div>

        <div className="max-w-4xl">
          <p className="text-[1.4rem] leading-[2.2rem] text-[#f0e4d0] sm:text-[1.7rem] sm:leading-[2.5rem]">
            {revealedNarration}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <p className="text-sm text-[#cbb7a3]">
            The parlour has closed. You can return to the cast and take the night
            another way.
          </p>
          <Link
            href={`/scripts/${scriptId}`}
            className="inline-flex min-h-11 items-center border border-white/12 px-4 text-sm uppercase tracking-[0.24em] text-[#f5ecde] transition hover:border-[#a8331a]"
          >
            Play again
          </Link>
        </div>
      </div>
    </div>
  );
}
