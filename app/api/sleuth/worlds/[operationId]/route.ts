import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/sleuth/db/client";
import { worlds } from "@/lib/sleuth/db/schema";
import {
  MarbleOperationError,
  worldGenerator,
} from "@/lib/sleuth/world-generator";
import type { WorldPrompt } from "@/lib/sleuth/world-generator";

export async function GET(
  _request: Request,
  context: { params: Promise<{ operationId: string }> },
): Promise<Response> {
  const { operationId } = await context.params;

  let pollResult;
  try {
    pollResult = await worldGenerator.poll(operationId);
  } catch (error) {
    if (
      error instanceof MarbleOperationError &&
      error.kind === "expired"
    ) {
      return regenerateExpired(operationId);
    }
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      { error: "poll-failed", detail: message },
      { status: 502 },
    );
  }

  if (!pollResult.done) {
    return NextResponse.json({
      done: false,
      operation_id: operationId,
    });
  }

  const splatUrl = pollResult.splat_url;
  if (!splatUrl) {
    return NextResponse.json(
      { error: "done-without-splat" },
      { status: 502 },
    );
  }

  const db = getDb();
  db.update(worlds)
    .set({ status: "done", splat_url: splatUrl })
    .where(eq(worlds.operation_id, operationId))
    .run();

  const body: { done: true; splat_url: string; degraded?: boolean } = {
    done: true,
    splat_url: splatUrl,
  };
  if (pollResult.degraded) {
    body.degraded = true;
  }
  return NextResponse.json(body);
}

async function regenerateExpired(operationId: string): Promise<Response> {
  const db = getDb();
  const row = db
    .select()
    .from(worlds)
    .where(eq(worlds.operation_id, operationId))
    .get();

  if (!row || !row.world_prompt_json) {
    return NextResponse.json(
      { error: "expired-and-unrecoverable" },
      { status: 410 },
    );
  }

  const worldPrompt = JSON.parse(row.world_prompt_json) as WorldPrompt;

  const result = await worldGenerator.generate({
    script_id: row.script_id,
    world_prompt: worldPrompt,
  });

  db.update(worlds)
    .set({ operation_id: result.operation_id, status: "pending" })
    .where(eq(worlds.script_id, row.script_id))
    .run();

  return NextResponse.json({
    done: false,
    operation_id: result.operation_id,
    regenerated: true,
  });
}
