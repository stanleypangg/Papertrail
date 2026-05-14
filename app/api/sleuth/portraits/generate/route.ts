import path from "node:path";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/sleuth/db/client";
import { worlds } from "@/lib/sleuth/db/schema";
import { requireEnv } from "@/lib/sleuth/env";
import { generatePortrait } from "@/lib/sleuth/images/client";
import { loadScript } from "@/lib/sleuth/scripts";

const PORTRAITS_REQUEST_SCHEMA = z.object({
  script_id: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const expectedSecret = requireEnv("SLEUTH_SECRET");
  const providedSecret = request.headers.get("x-sleuth-secret");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = PORTRAITS_REQUEST_SCHEMA.parse(await request.json());
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
  const existing = db
    .select()
    .from(worlds)
    .where(eq(worlds.script_id, parsed.script_id))
    .get();

  if (existing?.portraits_generated_at) {
    return NextResponse.json({ started: false, cached: true });
  }

  const script = loadScript(parsed.script_id);
  const portraitResults = await Promise.allSettled(
    script.cast.map((character) =>
      generatePortrait({
        characterName: character.name,
        publicBrief: character.publicBrief,
        scriptMood: script.worldPrompt.text_prompt,
        outPath: path.join(
          process.cwd(),
          "public",
          character.portrait.replace(/^\/+/, ""),
        ),
        force: true,
      }),
    ),
  );

  const failures = portraitResults.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    return NextResponse.json(
      {
        error: "portrait-generation-failed",
        failed: failures.length,
      },
      { status: 502 },
    );
  }

  const now = new Date();
  db.insert(worlds)
    .values({
      script_id: parsed.script_id,
      portraits_generated_at: now,
    })
    .onConflictDoUpdate({
      target: worlds.script_id,
      set: {
        portraits_generated_at: now,
      },
    })
    .run();

  return NextResponse.json(
    { started: true, generated: script.cast.length },
    { status: 202 },
  );
}
