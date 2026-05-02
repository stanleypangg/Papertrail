import type {
  ScriptCharacter,
  ScriptDefinition,
} from "@/lib/sleuth/scripts.types";

const LLM_FALLBACK_LINE = "...the room falls silent for a long moment.";
const SECRET_TOKEN_STOPWORDS = new Set([
  "about",
  "after",
  "against",
  "again",
  "before",
  "being",
  "father",
  "from",
  "into",
  "late",
  "letter",
  "naming",
  "pressure",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "under",
  "with",
  "would",
  "your",
  "you",
  "have",
  "that",
  "what",
  "when",
  "were",
  "sole",
]);

export interface ScoreAccusationInput {
  accusedCharacterId: string;
  playerCharacterId: string;
  playerSecretUncovered: boolean;
}

export interface ScoreAccusationResult {
  accusedCharacter: ScriptCharacter;
  bonusApplied: boolean;
  correct: boolean;
  endingId: "correct_accusation" | "wrong_accusation";
  murdererCharacter: ScriptCharacter;
  playerCharacter: ScriptCharacter;
  score: number;
}

export function scoreAccusation(
  script: ScriptDefinition,
  input: ScoreAccusationInput,
): ScoreAccusationResult {
  const accusedCharacter = requireCastMember(script, input.accusedCharacterId);
  const playerCharacter = requireCastMember(script, input.playerCharacterId);
  const murdererCharacter = requireMurderer(script);

  const correct = accusedCharacter.id === murdererCharacter.id;
  const endingId = correct ? "correct_accusation" : "wrong_accusation";
  const bonusApplied = !input.playerSecretUncovered;
  const score =
    script.endings[endingId].score +
    (bonusApplied ? script.endings.secret_defended_bonus.score : 0);

  return {
    accusedCharacter,
    bonusApplied,
    correct,
    endingId,
    murdererCharacter,
    playerCharacter,
    score,
  };
}

export function buildEndingNarrationFallback(
  script: ScriptDefinition,
  result: ScoreAccusationResult,
): string {
  const parts = [script.endings[result.endingId].narration];
  if (result.bonusApplied) {
    parts.push(script.endings.secret_defended_bonus.narration);
  }
  return parts.join("\n\n");
}

export function buildEndingSystemPrompt(
  script: ScriptDefinition,
  result: ScoreAccusationResult,
): string {
  return [
    `You are the host concluding "${script.title}".`,
    "Write one tight dramatic paragraph revealing the result of the accusation.",
    "Keep the voice elegant, severe, and rooted in the 1924 Shanghai parlour.",
    `The player character is ${result.playerCharacter.name}.`,
    `The accused suspect is ${result.accusedCharacter.name}.`,
    `The true murderer is ${result.murdererCharacter.name}.`,
    result.correct
      ? "The accusation is correct."
      : "The accusation is wrong, but the true murderer must still cast a shadow over the ending.",
    result.bonusApplied
      ? "Acknowledge that the player's own secret survived the night."
      : "The player's secret was exposed before the end.",
  ].join(" ");
}

export function buildEndingMessages(
  script: ScriptDefinition,
  result: ScoreAccusationResult,
): Array<{ role: "user"; content: string }> {
  return [
    {
      role: "user",
      content: [
        `Script: ${script.title}`,
        `Player: ${result.playerCharacter.name}`,
        `Accused: ${result.accusedCharacter.name}`,
        `True murderer: ${result.murdererCharacter.name}`,
        `Verdict: ${result.correct ? "correct" : "wrong"}`,
        `Score: ${result.score}`,
        `Base ending: ${script.endings[result.endingId].narration}`,
        result.bonusApplied
          ? `Bonus ending: ${script.endings.secret_defended_bonus.narration}`
          : "Bonus ending: not applied",
      ].join("\n\n"),
    },
    {
      role: "user",
      content:
        "Deliver the closing reveal in one paragraph, with no bullet points and no meta explanation.",
    },
  ];
}

export function resolveEndingNarration(
  script: ScriptDefinition,
  result: ScoreAccusationResult,
  generatedNarration: string,
): string {
  if (
    !generatedNarration.trim() ||
    generatedNarration.trim() === LLM_FALLBACK_LINE
  ) {
    return buildEndingNarrationFallback(script, result);
  }

  return generatedNarration;
}

export function didRevealPlayerSecret(
  playerSecret: string,
  replyContent: string,
): boolean {
  const secretTokens = extractDistinctiveTokens(playerSecret);
  if (secretTokens.length === 0) {
    return false;
  }

  const replyTokens = new Set(tokenize(replyContent));
  let matches = 0;

  for (const token of secretTokens) {
    if (replyTokens.has(token)) {
      matches += 1;
    }
    if (matches >= 2) {
      return true;
    }
  }

  return false;
}

function requireCastMember(
  script: ScriptDefinition,
  characterId: string,
): ScriptCharacter {
  const character = script.cast.find((candidate) => candidate.id === characterId);
  if (!character) {
    throw new Error(`Unknown Sleuth character: ${characterId}`);
  }
  return character;
}

function requireMurderer(script: ScriptDefinition): ScriptCharacter {
  const murderer = script.cast.find((candidate) => candidate.isMurderer);
  if (!murderer) {
    throw new Error(`Script ${script.id} has no murderer.`);
  }
  return murderer;
}

function extractDistinctiveTokens(secret: string): string[] {
  return tokenize(secret).filter(
    (token) =>
      token.length >= 4 && !SECRET_TOKEN_STOPWORDS.has(token),
  );
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
