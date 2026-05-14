import { describe, expect, it } from "vitest";

import {
  buildTurnCapIntervention,
  countNpcTurns,
  isNpcTurnCapReached,
  MAX_NPC_TURNS,
} from "@/components/sleuth/npc-chat";
import type { SleuthChatMessage } from "@/lib/sleuth/llm/client";

describe("components/sleuth/npc-chat", () => {
  it("counts completed NPC turns from assistant replies", () => {
    const history: SleuthChatMessage[] = [
      { role: "user", content: "Question one." },
      { role: "assistant", content: "Answer one." },
      { role: "user", content: "Question two." },
      { role: "assistant", content: "Answer two." },
    ];

    expect(countNpcTurns(history)).toBe(2);
    expect(isNpcTurnCapReached(history)).toBe(false);
  });

  it("caps each NPC at twelve replies and falls back to a host intervention", () => {
    const saturatedHistory: SleuthChatMessage[] = Array.from(
      { length: MAX_NPC_TURNS },
      (_, index) => ({
        role: "assistant",
        content: `answer-${index + 1}`,
      }),
    );

    expect(countNpcTurns(saturatedHistory)).toBe(MAX_NPC_TURNS);
    expect(isNpcTurnCapReached(saturatedHistory)).toBe(true);
    expect(buildTurnCapIntervention("Madam Wu")).toContain("room falls silent");
  });
});
