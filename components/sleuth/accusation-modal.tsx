"use client";

import Image from "next/image";
import { LoaderCircle, X } from "lucide-react";

import type { ScriptCharacter } from "@/lib/sleuth/scripts.types";

interface AccusationModalProps {
  cast: ScriptCharacter[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  selectedCharacterId: string | null;
  setSelectedCharacterId: (characterId: string) => void;
}

export function AccusationModal({
  cast,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  selectedCharacterId,
  setSelectedCharacterId,
}: AccusationModalProps) {
  return (
    <div className="fixed inset-0 z-40 bg-black/82 px-4 py-6 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-[92rem] items-end">
        <div className="w-full border border-white/10 bg-[linear-gradient(180deg,#181110_0%,#100b0a_100%)] text-[#f5ecde] shadow-[0_30px_140px_rgba(0,0,0,0.55)]">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.36em] text-[#b88f6b]">
                Accusation
              </div>
              <h2 className="mt-3 text-[2.2rem] leading-[0.92] text-[#f6ecdb] sm:text-[2.8rem]">
                Name the murderer.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#d7c8b5]">
                Choose carefully. The room will remember who you point toward when
                the tea cools for good.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center border border-white/12 transition hover:border-[#a8331a]"
              aria-label="Close accusation modal"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
            {cast.map((character) => {
              const selected = selectedCharacterId === character.id;

              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => setSelectedCharacterId(character.id)}
                  className={`overflow-hidden border text-left transition ${
                    selected
                      ? "border-[#a8331a] bg-[#201614]"
                      : "border-white/10 bg-[#120d0c] hover:border-white/28"
                  }`}
                >
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={character.portrait}
                      alt={character.name}
                      fill
                      sizes="(min-width: 1280px) 18vw, (min-width: 640px) 40vw, 88vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,7,0.08),rgba(10,8,7,0.82))]" />
                  </div>
                  <div className="px-4 py-4">
                    <div className="text-[0.68rem] uppercase tracking-[0.28em] text-[#b88f6b]">
                      Suspect
                    </div>
                    <div className="mt-2 text-[1.3rem] leading-tight text-[#f5ecde]">
                      {character.name}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#d7c8b5]">
                      {character.publicBrief}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-white/10 px-5 py-5 sm:px-6">
            {error ? (
              <p className="mb-4 text-sm leading-6 text-[#ddb8a0]">{error}</p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-[#cbb7a3]">
                The accusation will end the night immediately.
              </div>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!selectedCharacterId || isSubmitting}
                className="inline-flex min-h-11 items-center gap-3 border border-white/12 bg-[#1d1513] px-5 text-sm uppercase tracking-[0.24em] text-[#f5ecde] transition hover:border-[#a8331a] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Rendering verdict
                  </>
                ) : (
                  "Deliver accusation"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
