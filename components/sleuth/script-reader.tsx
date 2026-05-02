"use client";

import { startTransition, useMemo, useState } from "react";
import {
  BookOpenText,
  LoaderCircle,
  ScrollText,
  UserRound,
} from "lucide-react";

import { AccusationModal } from "@/components/sleuth/accusation-modal";
import { EndingCard } from "@/components/sleuth/ending-card";
import {
  NpcChat,
  type NpcConversationEntry,
  type NpcReplyRequest,
  type NpcReplyResult,
} from "@/components/sleuth/npc-chat";
import {
  WorldStatus,
  type PlayWorldState,
} from "@/components/sleuth/world-status";
import { WorldViewer } from "@/components/sleuth/world-viewer";
import { didRevealPlayerSecret } from "@/lib/sleuth/score";
import type {
  ScriptCharacter,
  ScriptDefinition,
} from "@/lib/sleuth/scripts.types";

interface ReaderThreadEntry {
  content: string;
  label: string;
  speaker: "host" | "npc" | "player";
}

interface ScriptReaderProps {
  bodyFontClassName: string;
  displayFontClassName: string;
  initialWorldState: PlayWorldState;
  openingMonologue: string;
  playerCharacter: ScriptCharacter;
  requestNpcReply: (request: NpcReplyRequest) => Promise<NpcReplyResult>;
  script: ScriptDefinition;
  uiFontClassName: string;
}

interface VerdictState {
  bonusApplied: boolean;
  correct: boolean;
  endingId: string;
  narration: string;
  score: number;
}

export function ScriptReader({
  bodyFontClassName,
  displayFontClassName,
  initialWorldState,
  openingMonologue,
  playerCharacter,
  requestNpcReply,
  script,
  uiFontClassName,
}: ScriptReaderProps) {
  const [worldState, setWorldState] = useState<PlayWorldState>(initialWorldState);
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [accusationOpen, setAccusationOpen] = useState(false);
  const [selectedAccusationId, setSelectedAccusationId] = useState<string | null>(
    null,
  );
  const [isSubmittingVerdict, setIsSubmittingVerdict] = useState(false);
  const [accusationError, setAccusationError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictState | null>(null);
  const [playerSecretUncovered, setPlayerSecretUncovered] = useState(false);
  const [conversations, setConversations] = useState<
    Record<string, NpcConversationEntry[]>
  >({});
  const [thread, setThread] = useState<ReaderThreadEntry[]>(
    openingMonologue.trim()
      ? [
          {
            content: openingMonologue,
            label: "Host",
            speaker: "host",
          },
        ]
      : [],
  );

  const activeNpc = useMemo(
    () => script.cast.find((character) => character.id === activeNpcId) ?? null,
    [activeNpcId, script.cast],
  );

  async function submitAccusation() {
    if (!selectedAccusationId || isSubmittingVerdict) {
      return;
    }

    setIsSubmittingVerdict(true);
    setAccusationError(null);

    try {
      const response = await fetch("/api/sleuth/score", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          script_id: script.id,
          accused_character_id: selectedAccusationId,
          player_character_id: playerCharacter.id,
          player_secret_uncovered: playerSecretUncovered,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `score-request-failed-${response.status}`);
      }

      const body = (await response.json()) as {
        bonus_applied: boolean;
        correct: boolean;
        ending_id: string;
        narration: string;
        score: number;
      };

      startTransition(() => {
        setAccusationOpen(false);
        setVerdict({
          bonusApplied: body.bonus_applied,
          correct: body.correct,
          endingId: body.ending_id,
          narration: body.narration,
          score: body.score,
        });
        setThread((current) => [
          ...current,
          {
            content: `I accuse ${
              script.cast.find((character) => character.id === selectedAccusationId)
                ?.name ?? selectedAccusationId
            }.`,
            label: playerCharacter.name,
            speaker: "player",
          },
          {
            content: body.narration,
            label: "Host",
            speaker: "host",
          },
        ]);
      });
    } catch (error) {
      setAccusationError(
        error instanceof Error
          ? error.message
          : "The verdict could not be rendered.",
      );
    } finally {
      setIsSubmittingVerdict(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#120d0c] text-[#f5ede0]">
      <div className="relative isolate min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(168,51,26,0.2),transparent_26%),radial-gradient(circle_at_78%_14%,rgba(214,178,116,0.12),transparent_20%),linear-gradient(180deg,#211514_0%,#15100f_42%,#0d0908_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:108px_108px]" />

        <section className="relative mx-auto grid min-h-screen max-w-[96rem] grid-cols-1 grid-rows-[minmax(21rem,48vh)_minmax(0,1fr)] gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(24rem,1fr)] lg:grid-rows-1 lg:px-8 lg:py-8">
          <div className="relative min-h-[21rem]">
            {worldState.kind === "done" ? (
              <WorldViewer
                activeNpcId={activeNpcId}
                cast={script.cast}
                degraded={worldState.degraded}
                onSelectNpc={setActiveNpcId}
                splatUrl={worldState.splatUrl}
              />
            ) : (
              <WorldStatus state={worldState} onStateChange={setWorldState} />
            )}

            {activeNpc ? (
              <NpcChat
                npc={activeNpc}
                conversation={conversations[activeNpc.id] ?? []}
                onClose={() => setActiveNpcId(null)}
                onConversationCommit={(nextConversation, payload) => {
                  const secretExposed = didRevealPlayerSecret(
                    playerCharacter.secret,
                    payload.replyContent,
                  );

                  startTransition(() => {
                    setConversations((current) => ({
                      ...current,
                      [activeNpc.id]: nextConversation,
                    }));
                    setPlayerSecretUncovered(
                      (current) => current || secretExposed,
                    );
                    setThread((current) => [
                      ...current,
                      {
                        content: payload.userMessage,
                        label: playerCharacter.name,
                        speaker: "player",
                      },
                      {
                        content: payload.replyContent,
                        label:
                          payload.replyRole === "assistant"
                            ? activeNpc.name
                            : "Host",
                        speaker:
                          payload.replyRole === "assistant" ? "npc" : "host",
                      },
                    ]);
                  });
                }}
                requestReply={requestNpcReply}
              />
            ) : null}
          </div>

          <aside className="flex min-h-0 flex-col border border-white/10 bg-[linear-gradient(180deg,rgba(245,237,224,0.96),rgba(231,218,200,0.94))] text-[#241b17] shadow-[0_30px_120px_rgba(0,0,0,0.38)]">
            <div className="border-b border-black/10 px-5 py-5 sm:px-6">
              <div
                className={`${uiFontClassName} text-[0.72rem] uppercase tracking-[0.38em] text-[#8a4a36]`}
              >
                {script.title}
              </div>
              <h1
                className={`${displayFontClassName} mt-3 text-[2.4rem] leading-[0.92] text-[#241b17] sm:text-[3rem]`}
              >
                {playerCharacter.name}
              </h1>
              <p
                className={`${bodyFontClassName} mt-3 max-w-[34rem] text-[1.08rem] leading-relaxed italic text-[#4f3a32]`}
              >
                {playerCharacter.publicBrief}
              </p>
            </div>

            <div className="border-b border-black/10 px-5 py-5 sm:px-6">
              <div className="inline-flex items-center gap-3 text-[0.74rem] uppercase tracking-[0.3em] text-[#8a4a36]">
                <BookOpenText className="size-4" />
                Your private brief
              </div>
              <p
                className={`${bodyFontClassName} mt-4 text-[1.08rem] leading-8 text-[#2f241f]`}
              >
                {playerCharacter.privateBrief}
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-black/10 px-5 py-4 sm:px-6">
                <div className="inline-flex items-center gap-3 text-[0.74rem] uppercase tracking-[0.3em] text-[#8a4a36]">
                  <ScrollText className="size-4" />
                  Parlour transcript
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="space-y-4">
                  {thread.length === 0 ? (
                    <article className="border border-black/10 bg-white/30 px-4 py-4 text-sm leading-7 text-[#4f3a32]">
                      The host is gathering the room.
                    </article>
                  ) : (
                    thread.map((entry, index) => {
                      const isPlayer = entry.speaker === "player";

                      return (
                        <div
                          key={`${entry.label}-${index}-${entry.content.slice(0, 24)}`}
                          className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}
                        >
                          <article
                            className={`max-w-[92%] border px-4 py-4 ${
                              isPlayer
                                ? "border-[#3e2f29] bg-[#181311] text-[#f4ebdd]"
                                : entry.speaker === "host"
                                  ? "border-[#a8331a]/30 bg-[#f7f0e5] text-[#2a1f1b]"
                                  : "border-black/10 bg-[#fffaf1] text-[#291f1b]"
                            }`}
                          >
                            <div
                              className={`${uiFontClassName} text-[0.68rem] uppercase tracking-[0.28em] ${
                                isPlayer ? "text-[#d7c1a8]" : "text-[#a8331a]"
                              }`}
                            >
                              {entry.label}
                            </div>
                            <p
                              className={`${bodyFontClassName} mt-3 text-[1rem] leading-7`}
                            >
                              {entry.content}
                            </p>
                          </article>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-black/10 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="inline-flex items-center gap-3 text-sm text-[#5a4339]">
                  <UserRound className="size-4 text-[#a8331a]" />
                  {playerSecretUncovered
                    ? "Your secret has started to surface in the room."
                    : "Question a suspect in the scene to extend the transcript."}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNpcId(null);
                    setAccusationError(null);
                    setAccusationOpen(true);
                  }}
                  className="inline-flex min-h-11 items-center border border-[#a8331a]/40 bg-[#f1e7d8] px-4 text-sm uppercase tracking-[0.24em] text-[#4d2419] transition hover:border-[#a8331a] hover:bg-[#f6edde]"
                >
                  I&apos;m ready to accuse
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {accusationOpen ? (
        <AccusationModal
          cast={script.cast}
          error={accusationError}
          isSubmitting={isSubmittingVerdict}
          onClose={() => {
            if (!isSubmittingVerdict) {
              setAccusationOpen(false);
            }
          }}
          onSubmit={() => {
            void submitAccusation();
          }}
          selectedCharacterId={selectedAccusationId}
          setSelectedCharacterId={setSelectedAccusationId}
        />
      ) : null}

      {isSubmittingVerdict && !verdict ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 backdrop-blur-sm">
          <div className="border border-white/12 bg-[#120d0c] px-6 py-5 text-center text-[#f5ecde] shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
            <LoaderCircle className="mx-auto size-6 animate-spin text-[#a8331a]" />
            <div className="mt-4 text-[0.72rem] uppercase tracking-[0.3em] text-[#b88f6b]">
              Rendering verdict
            </div>
          </div>
        </div>
      ) : null}

      {verdict ? (
        <EndingCard
          key={`${verdict.endingId}-${verdict.narration}`}
          endingId={verdict.endingId}
          narration={verdict.narration}
          score={verdict.score}
          scriptId={script.id}
          title={verdict.correct ? "Verdict." : "The Wrong Shadow."}
        />
      ) : null}
    </main>
  );
}
