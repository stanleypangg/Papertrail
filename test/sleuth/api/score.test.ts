import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  streamHost: vi.fn(),
}));

vi.mock("@/lib/sleuth/llm/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/sleuth/llm/client")
  >("@/lib/sleuth/llm/client");
  return {
    ...actual,
    streamHost: mocks.streamHost,
  };
});

import { POST } from "@/app/api/sleuth/score/route";

function makeRequest(body: {
  script_id: string;
  accused_character_id: string;
  player_character_id: string;
  player_secret_uncovered: boolean;
}): Request {
  return new Request("http://localhost/api/sleuth/score", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sleuth/score", () => {
  beforeEach(() => {
    mocks.streamHost.mockReset();
    mocks.streamHost.mockResolvedValue(
      "The host names Madam Wu with terrible calm.",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for an invalid accusation payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/sleuth/score", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          script_id: "the-empress-last-tea",
          accused_character_id: "",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid-body" });
  });

  it("returns a correct verdict with the secret-defended bonus and generated narration", async () => {
    const response = await POST(
      makeRequest({
        script_id: "the-empress-last-tea",
        accused_character_id: "madam-wu",
        player_character_id: "mei-lin",
        player_secret_uncovered: false,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      correct: true,
      score: 125,
      ending_id: "correct_accusation",
      narration: "The host names Madam Wu with terrible calm.",
      bonus_applied: true,
    });
    expect(mocks.streamHost).toHaveBeenCalledTimes(1);
  });

  it("returns a wrong verdict with no bonus when the player's secret was uncovered", async () => {
    mocks.streamHost.mockResolvedValue("The accusation strikes the wrong shadow.");

    const response = await POST(
      makeRequest({
        script_id: "the-empress-last-tea",
        accused_character_id: "inspector-ren",
        player_character_id: "mei-lin",
        player_secret_uncovered: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      correct: false,
      score: 0,
      ending_id: "wrong_accusation",
      narration: "The accusation strikes the wrong shadow.",
      bonus_applied: false,
    });
  });
});
