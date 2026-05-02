import { describe, expect, it } from "vitest";

import {
  buildEndingNarrationFallback,
  didRevealPlayerSecret,
  scoreAccusation,
} from "@/lib/sleuth/score";
import { loadScript } from "@/lib/sleuth/scripts";

describe("lib/sleuth/score", () => {
  const script = loadScript("the-empress-last-tea");

  it("scores a correct accusation and applies the secret-defended bonus when the player stayed covered", () => {
    const result = scoreAccusation(script, {
      accusedCharacterId: "madam-wu",
      playerCharacterId: "mei-lin",
      playerSecretUncovered: false,
    });

    expect(result.correct).toBe(true);
    expect(result.endingId).toBe("correct_accusation");
    expect(result.score).toBe(125);
    expect(result.bonusApplied).toBe(true);
  });

  it("scores a wrong accusation without the bonus when the player's secret was uncovered", () => {
    const result = scoreAccusation(script, {
      accusedCharacterId: "inspector-ren",
      playerCharacterId: "mei-lin",
      playerSecretUncovered: true,
    });

    expect(result.correct).toBe(false);
    expect(result.endingId).toBe("wrong_accusation");
    expect(result.score).toBe(0);
    expect(result.bonusApplied).toBe(false);
  });

  it("detects when an NPC reply exposes the player's secret details", () => {
    const revealed = didRevealPlayerSecret(
      "You forged one letter from your late father to pressure the dowager into naming you sole heir.",
      "You think I did not notice the forged letter and your pressure over the sole heir claim?",
    );
    const concealed = didRevealPlayerSecret(
      "You forged one letter from your late father to pressure the dowager into naming you sole heir.",
      "Your nerves are loud tonight, but that proves nothing.",
    );

    expect(revealed).toBe(true);
    expect(concealed).toBe(false);
  });

  it("builds a fallback narration that folds in the bonus line when earned", () => {
    const result = scoreAccusation(script, {
      accusedCharacterId: "madam-wu",
      playerCharacterId: "mei-lin",
      playerSecretUncovered: false,
    });

    const narration = buildEndingNarrationFallback(script, result);

    expect(narration).toContain(script.endings.correct_accusation.narration);
    expect(narration).toContain(script.endings.secret_defended_bonus.narration);
  });
});
