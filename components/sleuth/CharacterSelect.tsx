"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ScriptCharacter } from "@/lib/sleuth/scripts.types";

const POSTER_LAYOUT: Record<
  string,
  {
    left: string;
    top: string;
    width: string;
    rotation: string;
    zIndex: number;
  }
> = {
  "mei-lin": {
    left: "4%",
    top: "19%",
    width: "25%",
    rotation: "-5deg",
    zIndex: 4,
  },
  "madam-wu": {
    left: "28%",
    top: "4%",
    width: "28%",
    rotation: "1.5deg",
    zIndex: 6,
  },
  "inspector-ren": {
    left: "56%",
    top: "16%",
    width: "24%",
    rotation: "5deg",
    zIndex: 4,
  },
  "li-shao": {
    left: "17%",
    top: "48%",
    width: "23%",
    rotation: "4deg",
    zIndex: 3,
  },
  "jin-qiao": {
    left: "48%",
    top: "50%",
    width: "21%",
    rotation: "-3deg",
    zIndex: 5,
  },
};

interface CharacterSelectProps {
  scriptId: string;
  cast: ScriptCharacter[];
  displayFontClassName: string;
  bodyFontClassName: string;
  uiFontClassName: string;
}

export function CharacterSelect({
  scriptId,
  cast,
  displayFontClassName,
  bodyFontClassName,
  uiFontClassName,
}: CharacterSelectProps) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#120d0c]/70 px-5 py-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(168,51,26,0.18),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(212,176,106,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-x-6 top-4 text-[4.5rem] leading-none tracking-[0.8em] text-white/[0.035] sm:text-[7rem]">
        秘 密 茶 夜
      </div>

      <div className="relative mx-auto hidden h-[52rem] max-w-[78rem] lg:block">
        {cast.map((character) => {
          const layout = POSTER_LAYOUT[character.id];
          const isDimmed = hoveredId !== null && hoveredId !== character.id;
          const isHovered = hoveredId === character.id;

          return (
            <button
              key={character.id}
              type="button"
              onMouseEnter={() => setHoveredId(character.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(character.id)}
              onBlur={() => setHoveredId(null)}
              onClick={() =>
                router.push(`/scripts/${scriptId}/play?character=${character.id}`)
              }
              className="group absolute m-0 border-0 bg-transparent p-0 text-left transition-all duration-300 ease-out"
              style={{
                left: layout.left,
                top: layout.top,
                width: layout.width,
                zIndex: layout.zIndex,
                transform: `rotate(${layout.rotation}) translateY(${isHovered ? "-8px" : "0"})`,
                opacity: isDimmed ? 0.38 : 1,
              }}
              aria-label={`Choose ${character.name}`}
            >
              <div
                className="overflow-hidden border border-white/10 bg-[#100b0a] shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition-all duration-300"
                style={{
                  boxShadow: isHovered
                    ? "0 28px 90px rgba(0,0,0,0.58), 0 0 0 1px rgba(168,51,26,0.9), 0 0 42px rgba(168,51,26,0.35)"
                    : "0 24px 80px rgba(0,0,0,0.55)",
                }}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <Image
                    src={character.portrait}
                    alt={character.name}
                    fill
                    sizes="(min-width: 1024px) 28vw, 90vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,7,6,0.08),rgba(11,7,6,0.24)_34%,rgba(11,7,6,0.84)_100%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(212,176,106,0.14),transparent_40%)]" />
                </div>
                <div className="border-t border-white/8 bg-[#130e0d]/94 px-4 py-4">
                  <div
                    className={`${displayFontClassName} text-[2rem] leading-[0.9] tracking-[0.02em] text-[#f2e7d0]`}
                  >
                    {character.name}
                  </div>
                  <p
                    className={`${bodyFontClassName} mt-2 text-[0.98rem] italic leading-relaxed text-[#d7c7b2]`}
                  >
                    {character.publicBrief}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="relative grid gap-5 lg:hidden">
        {cast.map((character) => (
          <button
            key={character.id}
            type="button"
            onClick={() =>
              router.push(`/scripts/${scriptId}/play?character=${character.id}`)
            }
            className="overflow-hidden border border-white/10 bg-[#130e0d]/94 text-left shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="relative aspect-[5/4] w-full">
              <Image
                src={character.portrait}
                alt={character.name}
                fill
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,7,6,0.1),rgba(11,7,6,0.78))]" />
            </div>
            <div className="px-4 py-4">
              <div
                className={`${displayFontClassName} text-[1.85rem] leading-[0.95] text-[#f2e7d0]`}
              >
                {character.name}
              </div>
              <p
                className={`${bodyFontClassName} mt-2 text-[0.98rem] italic leading-relaxed text-[#d7c7b2]`}
              >
                {character.publicBrief}
              </p>
              <div
                className={`${uiFontClassName} mt-4 text-[0.72rem] uppercase tracking-[0.32em] text-[#b68e6b]`}
              >
                Enter the parlour
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
