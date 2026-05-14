"use client";

import {
  startTransition,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { MessageSquareMore, SendHorizonal, X } from "lucide-react";

import type { ScriptCharacter } from "@/lib/sleuth/scripts.types";
import type { SleuthChatMessage } from "@/lib/sleuth/llm/client";

export const MAX_NPC_TURNS = 12;

export interface NpcConversationEntry {
  role: "user" | "assistant" | "host";
  content: string;
}

export interface NpcReplyRequest {
  npcId: string;
  history: SleuthChatMessage[];
  userMessage: string;
}

export interface NpcReplyResult {
  role: "assistant" | "host";
  content: string;
  capped: boolean;
}

interface NpcChatProps {
  npc: ScriptCharacter;
  conversation: NpcConversationEntry[];
  onClose: () => void;
  onConversationCommit: (
    nextConversation: NpcConversationEntry[],
    payload: {
      userMessage: string;
      replyRole: "assistant" | "host";
      replyContent: string;
    },
  ) => void;
  requestReply: (request: NpcReplyRequest) => Promise<NpcReplyResult>;
}

export function countNpcTurns(
  history: Array<Pick<NpcConversationEntry, "role">>,
): number {
  return history.filter((entry) => entry.role === "assistant").length;
}

export function isNpcTurnCapReached(
  history: Array<Pick<NpcConversationEntry, "role">>,
): boolean {
  return countNpcTurns(history) >= MAX_NPC_TURNS;
}

export function buildTurnCapIntervention(npcName: string): string {
  return `...the room falls silent for a long moment. ${npcName} has given all they will tonight, and the host's gaze presses you back toward the wider parlour.`;
}

export function NpcChat({
  npc,
  conversation,
  onClose,
  onConversationCommit,
  requestReply,
}: NpcChatProps) {
  const [draft, setDraft] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleConversation = useMemo(() => {
    if (conversation.length > 0) {
      return conversation;
    }

    return [
      {
        role: "host" as const,
        content: `${npc.name} turns toward you, careful not to show more than the room already suspects.`,
      },
    ];
  }, [conversation, npc.name]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const userMessage = draft.trim();
    if (!userMessage || isPending) {
      return;
    }

    setError(null);

    if (isNpcTurnCapReached(conversation)) {
      const replyContent = buildTurnCapIntervention(npc.name);
      onConversationCommit(
        [
          ...conversation,
          { role: "user", content: userMessage },
          { role: "host", content: replyContent },
        ],
        {
          userMessage,
          replyRole: "host",
          replyContent,
        },
      );
      setDraft("");
      return;
    }

    setIsPending(true);

    startTransition(() => {
      void (async () => {
        try {
          const result = await requestReply({
            npcId: npc.id,
            history: conversation.reduce<SleuthChatMessage[]>((messages, entry) => {
              if (entry.role === "host") {
                return messages;
              }

              messages.push({
                role: entry.role,
                content: entry.content,
              });
              return messages;
            }, []),
            userMessage,
          });

          onConversationCommit(
            [
              ...conversation,
              { role: "user", content: userMessage },
              { role: result.role, content: result.content },
            ],
            {
              userMessage,
              replyRole: result.role,
              replyContent: result.content,
            },
          );
          setDraft("");
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "The NPC does not answer clearly.";
          setError(message);
        } finally {
          setIsPending(false);
        }
      })();
    });
  }

  return (
    <aside className="absolute inset-x-4 bottom-4 z-30 border border-white/12 bg-[#140f0e]/96 text-[#f3e7d3] shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-sm lg:inset-x-auto lg:right-6 lg:top-6 lg:w-[min(30rem,calc(100vw-4rem))]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.32em] text-[#b88f6b]">
            Interrogation
          </div>
          <h2 className="mt-2 text-2xl text-[#f6ecdb]">{npc.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[#d7c8b5]">{npc.publicBrief}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 min-w-10 items-center justify-center border border-white/12 text-[#f3e7d3] transition hover:border-[#a8331a]"
          aria-label={`Close ${npc.name} chat`}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[20rem] overflow-y-auto px-5 py-4 lg:max-h-[24rem]">
        <div className="space-y-3">
          {visibleConversation.map((entry, index) => {
            const isPlayer = entry.role === "user";
            const isHost = entry.role === "host";

            return (
              <div
                key={`${entry.role}-${index}-${entry.content.slice(0, 24)}`}
                className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}
              >
                <article
                  className={`max-w-[88%] border px-4 py-3 text-sm leading-6 ${
                    isPlayer
                      ? "border-[#3f2d27] bg-[#f4ecde] text-[#1e1816]"
                      : isHost
                        ? "border-[#7b5c49] bg-[#221917] text-[#f0dfc7]"
                        : "border-white/10 bg-[#171110] text-[#f5ebda]"
                  }`}
                >
                  <div className="mb-2 text-[0.68rem] uppercase tracking-[0.28em] text-[#b88f6b]">
                    {isPlayer ? "You" : isHost ? "Host" : npc.name}
                  </div>
                  {entry.content}
                </article>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-white/10 px-5 py-4">
        <label className="block">
          <span className="mb-2 inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[#b88f6b]">
            <MessageSquareMore className="size-4" />
            Your next question
          </span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder={`Ask ${npc.name} what they were protecting when the tea was poured.`}
            className="w-full resize-none border border-white/12 bg-[#0f0b0a] px-4 py-3 text-sm leading-6 text-[#f6ecdb] outline-none transition placeholder:text-[#8c7667] focus:border-[#a8331a]"
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm leading-6 text-[#d5b59e]">{error}</p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="text-[0.72rem] uppercase tracking-[0.26em] text-[#b9a48e]">
            {Math.min(countNpcTurns(conversation), MAX_NPC_TURNS)}/{MAX_NPC_TURNS} replies used
          </div>
          <button
            type="submit"
            disabled={isPending || draft.trim().length === 0}
            className="inline-flex min-h-11 items-center gap-3 border border-white/12 bg-[#1b1412] px-4 text-sm uppercase tracking-[0.22em] text-[#f3e7d3] transition hover:border-[#a8331a] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <SendHorizonal className="size-4" />
            {isPending ? "Listening" : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}
