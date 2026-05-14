import { readFileSync } from "node:fs";
import path from "node:path";

import {
  type ScriptCharacter,
  type ScriptDefinition,
  scriptDefinitionSchema,
} from "@/lib/sleuth/scripts.types";
import type { SleuthChatMessage } from "@/lib/sleuth/llm/client";

const SCRIPTS_DIR = path.join(process.cwd(), "data", "scripts");

export function loadScript(id: string): ScriptDefinition {
  const filePath = path.join(SCRIPTS_DIR, `${id}.json`);

  let rawText: string;
  try {
    rawText = readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Unknown Sleuth script: ${id}`);
    }
    throw error;
  }

  const parsed = JSON.parse(rawText) as unknown;
  return scriptDefinitionSchema.parse(parsed);
}

export function getPlayableCharacter(
  script: ScriptDefinition,
  requestedCharacterId: string | null | undefined,
): ScriptCharacter | null {
  if (!requestedCharacterId) {
    return null;
  }

  return (
    script.cast.find(
      (character) =>
        character.id === requestedCharacterId && character.playerSelectable,
    ) ?? null
  );
}

export function buildHostOpeningSystemPrompt(
  script: ScriptDefinition,
  playerCharacter: ScriptCharacter,
): string {
  return [
    `You are the host of "${script.title}", a single-player murder-mystery.`,
    `Setting: ${script.synopsis}`,
    "Speak with measured authority, vivid sensory detail, and short dramatic paragraphs.",
    "Keep the player grounded in the scene, the suspects, and the available next tensions.",
    `The player is roleplaying ${playerCharacter.name}. Do not reveal their secret outright.`,
    "Stay in character as the host and never break the fiction.",
  ].join(" ");
}

export function buildHostOpeningMessages(
  script: ScriptDefinition,
  playerCharacter: ScriptCharacter,
): SleuthChatMessage[] {
  const clueSummary = script.clues
    .map((clue) => `- ${clue.location}: ${clue.reveals.join(" ")}`)
    .join("\n");

  return [
    {
      role: "user",
      content: [
        `Script: ${script.title}`,
        `Synopsis: ${script.synopsis}`,
        `Player character: ${playerCharacter.name}`,
        `Public brief: ${playerCharacter.publicBrief}`,
        `Private brief: ${playerCharacter.privateBrief}`,
        `Known clues:\n${clueSummary}`,
      ].join("\n\n"),
    },
    {
      role: "user",
      content:
        "Open the play session with a host monologue that places the player inside the tea parlour and makes the first suspect interactions feel urgent.",
    },
  ];
}

export function buildNpcSystemPrompt(
  script: ScriptDefinition,
  npcCharacter: ScriptCharacter,
  playerCharacter: ScriptCharacter,
): string {
  return [
    `You are ${npcCharacter.name} inside "${script.title}".`,
    "Stay in character at all times.",
    `Your public face: ${npcCharacter.publicBrief}`,
    `What you are protecting: ${npcCharacter.secret}`,
    `The player is ${playerCharacter.name}. They know only their own private brief and what they can infer in conversation.`,
    "Answer as the NPC in first person. Deflect cleanly when pressed on your secret, but do not become incoherent.",
    "Keep each reply to two or three sentences unless directly asked for details.",
  ].join(" ");
}
