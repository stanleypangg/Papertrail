 import { eq } from "drizzle-orm";
import {
  Cormorant_Garamond,
  EB_Garamond,
  Manrope,
} from "next/font/google";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ScriptReader } from "@/components/sleuth/script-reader";
import { getDb } from "@/lib/sleuth/db/client";
import { worlds } from "@/lib/sleuth/db/schema";
import { requireEnv } from "@/lib/sleuth/env";
import type { SleuthChatMessage } from "@/lib/sleuth/llm/client";
import { npcReply, streamHost } from "@/lib/sleuth/llm/client";
import {
  buildHostOpeningMessages,
  buildHostOpeningSystemPrompt,
  buildNpcSystemPrompt,
  getPlayableCharacter,
  loadScript,
} from "@/lib/sleuth/scripts";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const proseFont = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const uiFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const MAX_NPC_TURNS = 12;

type InitialWorldState =
  | {
      kind: "pending";
      operationId: string;
      startedAt: number;
      degraded: boolean;
    }
  | {
      kind: "done";
      splatUrl: string;
      operationId?: string;
      degraded: boolean;
    }
  | {
      kind: "error";
      message: string;
      operationId?: string;
      degraded: boolean;
    };

interface PlayPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    character?: string | string[];
  }>;
}

export default async function PlayPage({
  params,
  searchParams,
}: PlayPageProps) {
  const { id } = await params;
  const { character } = await searchParams;

  const script = loadScriptOrNotFound(id);
  const characterId = Array.isArray(character) ? character[0] : character;
  const playerCharacter = getPlayableCharacter(script, characterId);

  if (!playerCharacter) {
    redirect(`/scripts/${id}`);
  }

  let initialWorldState: InitialWorldState;
  try {
    const headerStore = await headers();
    const baseUrl = resolveBaseUrl(headerStore);
    initialWorldState = await resolveInitialWorldState(baseUrl, script);
  } catch {
    initialWorldState = { kind: "error", degraded: true, message: "World generation unavailable in demo mode." };
  }

  let openingMonologue: string;
  try {
    openingMonologue = await streamHost(
      buildHostOpeningSystemPrompt(script, playerCharacter),
      buildHostOpeningMessages(script, playerCharacter),
    );
  } catch {
    openingMonologue = `Welcome to "${script.title}." ${script.synopsis} You are ${playerCharacter.name}. ${playerCharacter.publicBrief} Look around, speak with the other suspects, and piece together what happened here tonight.`;
  }

  async function requestNpcReply(input: {
    npcId: string;
    history: SleuthChatMessage[];
    userMessage: string;
  }): Promise<{ role: "assistant" | "host"; content: string; capped: boolean }> {
    "use server";

    const liveScript = loadScriptOrNotFound(id);
    const livePlayerCharacter = getPlayableCharacter(liveScript, characterId);
    const npcCharacter = liveScript.cast.find(
      (candidate) => candidate.id === input.npcId,
    );

    if (!livePlayerCharacter || !npcCharacter) {
      return {
        role: "host",
        content:
          "...the room falls silent for a long moment. The question finds no one willing to answer it cleanly.",
        capped: true,
      };
    }

    const npcTurns = input.history.filter(
      (message) => message.role === "assistant",
    ).length;

    if (npcTurns >= MAX_NPC_TURNS) {
      return {
        role: "host",
        content: `...the room falls silent for a long moment. ${npcCharacter.name} has given all they will tonight, and the host's gaze pulls you back toward the wider parlour.`,
        capped: true,
      };
    }

    const response = await npcReply(
      npcCharacter.id,
      buildNpcSystemPrompt(liveScript, npcCharacter, livePlayerCharacter),
      input.history,
      input.userMessage,
    );

    return {
      role: "assistant",
      content: response,
      capped: false,
    };
  }

  return (
    <ScriptReader
      bodyFontClassName={proseFont.className}
      displayFontClassName={displayFont.className}
      initialWorldState={initialWorldState}
      openingMonologue={openingMonologue}
      playerCharacter={playerCharacter}
      requestNpcReply={requestNpcReply}
      script={script}
      uiFontClassName={uiFont.className}
    />
  );
}

function loadScriptOrNotFound(id: string) {
  try {
    return loadScript(id);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Unknown Sleuth script:")
    ) {
      notFound();
    }
    throw error;
  }
}

function resolveBaseUrl(headerStore: Headers): string {
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol = forwardedProto ?? "http";
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");

  if (!host) {
    throw new Error("Unable to resolve request host for Sleuth play page.");
  }

  return `${protocol}://${host}`;
}

async function resolveInitialWorldState(
  baseUrl: string,
  script: ReturnType<typeof loadScript>,
): Promise<InitialWorldState> {
  const cachedWorld = getDb()
    .select()
    .from(worlds)
    .where(eq(worlds.script_id, script.id))
    .get();

  if (cachedWorld?.status === "done" && cachedWorld.splat_url) {
    return {
      kind: "done",
      operationId: cachedWorld.operation_id ?? undefined,
      splatUrl: cachedWorld.splat_url,
      degraded: cachedWorld.operation_id?.startsWith("mock-") ?? false,
    };
  }

  if (cachedWorld?.status === "pending" && cachedWorld.operation_id) {
    return {
      kind: "pending",
      operationId: cachedWorld.operation_id,
      degraded: cachedWorld.operation_id.startsWith("mock-"),
      startedAt: cachedWorld.created_at?.getTime() ?? Date.now(),
    };
  }

  let secret: string;
  try {
    secret = requireEnv("SLEUTH_SECRET");
  } catch {
    return {
      kind: "error",
      degraded: true,
      message: "World generation unavailable in demo mode.",
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/sleuth/worlds/generate`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-sleuth-secret": secret,
      },
      body: JSON.stringify({
        script_id: script.id,
        world_prompt: script.worldPrompt,
        display_name: script.title,
      }),
    });

    if (!response.ok) {
      return {
        kind: "error",
        degraded: false,
        message: `The world request failed with ${response.status}.`,
      };
    }

    const body = (await response.json()) as {
      done?: boolean;
      splat_url?: string;
      operation_id?: string;
      degraded?: boolean;
    };

    if (body.done && typeof body.splat_url === "string") {
      return {
        kind: "done",
        operationId: body.operation_id,
        splatUrl: body.splat_url,
        degraded: body.degraded === true,
      };
    }

    if (typeof body.operation_id === "string") {
      return {
        kind: "pending",
        operationId: body.operation_id,
        degraded: body.degraded === true,
        startedAt: Date.now(),
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return {
      kind: "error",
      degraded: false,
      message: `The world request failed before the viewer could start polling: ${message}`,
    };
  }

  return {
    kind: "error",
    degraded: false,
    message: "The world request returned an unexpected payload.",
  };
}
