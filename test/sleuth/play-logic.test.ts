import { describe, expect, it } from "vitest";

import {
  buildHostOpeningMessages,
  buildNpcSystemPrompt,
  getPlayableCharacter,
  loadScript,
} from "@/lib/sleuth/scripts";

describe("Phase 7 play-page script helpers", () => {
  const script = loadScript("the-empress-last-tea");

  it("returns null when the requested play character is missing or invalid", () => {
    expect(getPlayableCharacter(script, undefined)).toBeNull();
    expect(getPlayableCharacter(script, "")).toBeNull();
    expect(getPlayableCharacter(script, "unknown-character")).toBeNull();
  });

  it("returns the selected cast member when the requested play character exists", () => {
    const player = getPlayableCharacter(script, "mei-lin");

    expect(player?.id).toBe("mei-lin");
    expect(player?.playerSelectable).toBe(true);
  });

  it("builds the host opening seed with the player's private brief in the prompt cache prefix", () => {
    const player = getPlayableCharacter(script, "mei-lin");
    if (!player) {
      throw new Error("expected playable character");
    }

    const messages = buildHostOpeningMessages(script, player);

    expect(messages[0]?.role).toBe("user");
    expect(messages[0]?.content).toContain(script.title);
    expect(messages[0]?.content).toContain(player.privateBrief);
    expect(messages[0]?.content).toContain("Known clues");
  });

  it("builds an NPC system prompt that includes the NPC secret and roleplay guardrails", () => {
    const player = getPlayableCharacter(script, "mei-lin");
    const npc = script.cast.find((character) => character.id === "madam-wu");

    if (!player || !npc) {
      throw new Error("expected test cast members");
    }

    const systemPrompt = buildNpcSystemPrompt(script, npc, player);

    expect(systemPrompt).toContain(npc.secret);
    expect(systemPrompt).toContain(player.name);
    expect(systemPrompt).toContain("Stay in character");
  });
});
