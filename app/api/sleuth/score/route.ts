import { NextResponse } from "next/server";
import { z } from "zod";

import { streamHost } from "@/lib/sleuth/llm/client";
import { loadScript } from "@/lib/sleuth/scripts";
import {
  buildEndingMessages,
  buildEndingNarrationFallback,
  buildEndingSystemPrompt,
  resolveEndingNarration,
  scoreAccusation,
} from "@/lib/sleuth/score";

const SCORE_BODY_SCHEMA = z.object({
  script_id: z.string().min(1),
  accused_character_id: z.string().min(1),
  player_character_id: z.string().min(1),
  player_secret_uncovered: z.boolean(),
});

export async function POST(request: Request): Promise<Response> {
  let parsed;
  try {
    const json = await request.json();
    parsed = SCORE_BODY_SCHEMA.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid-body", issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  let script;
  try {
    script = loadScript(parsed.script_id);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Unknown Sleuth script:")
    ) {
      return NextResponse.json({ error: "script-not-found" }, { status: 404 });
    }
    throw error;
  }

  const result = scoreAccusation(script, {
    accusedCharacterId: parsed.accused_character_id,
    playerCharacterId: parsed.player_character_id,
    playerSecretUncovered: parsed.player_secret_uncovered,
  });

  const generatedNarration = await streamHost(
    buildEndingSystemPrompt(script, result),
    buildEndingMessages(script, result),
  );

  const narration = resolveEndingNarration(script, result, generatedNarration);

  return NextResponse.json({
    correct: result.correct,
    score: result.score,
    ending_id: result.endingId,
    narration:
      narration.trim() || buildEndingNarrationFallback(script, result),
    bonus_applied: result.bonusApplied,
  });
}
