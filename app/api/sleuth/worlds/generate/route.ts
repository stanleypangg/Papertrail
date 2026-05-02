import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/sleuth/db/client";
import { worlds } from "@/lib/sleuth/db/schema";
import { requireEnv } from "@/lib/sleuth/env";
import { worldGenerator } from "@/lib/sleuth/world-generator";

const SLEUTH_GENERATE_SCHEMA = z.object({
  script_id: z.string().min(1),
  world_prompt: z.object({
    type: z.literal("text"),
    text_prompt: z.string().min(1),
    disable_recaption: z.boolean().nullable().optional(),
  }),
  display_name: z.string().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const expectedSecret = requireEnv("SLEUTH_SECRET");
  const providedSecret = request.headers.get("x-sleuth-secret");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    const json = await request.json();
    parsed = SLEUTH_GENERATE_SCHEMA.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid-body", issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const db = getDb();
  const cached = db
    .select()
    .from(worlds)
    .where(eq(worlds.script_id, parsed.script_id))
    .get();

  if (cached?.status === "done" && cached.splat_url) {
    return NextResponse.json({
      done: true,
      splat_url: cached.splat_url,
      cached: true,
    });
  }

  const result = await worldGenerator.generate({
    script_id: parsed.script_id,
    world_prompt: parsed.world_prompt,
    display_name: parsed.display_name,
  });

  const now = new Date();
  db.insert(worlds)
    .values({
      script_id: parsed.script_id,
      operation_id: result.operation_id,
      splat_url: null,
      status: "pending",
      world_prompt_json: JSON.stringify(parsed.world_prompt),
      created_at: now,
      expires_at: null,
    })
    .onConflictDoUpdate({
      target: worlds.script_id,
      set: {
        operation_id: result.operation_id,
        splat_url: null,
        status: "pending",
        world_prompt_json: JSON.stringify(parsed.world_prompt),
        created_at: now,
        expires_at: null,
      },
    })
    .run();

  const body: { operation_id: string; degraded?: boolean } = {
    operation_id: result.operation_id,
  };
  if (result.degraded) {
    body.degraded = true;
  }
  return NextResponse.json(body);
}
