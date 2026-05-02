import { NextResponse } from "next/server";

import { generateWorldLabsScene } from "@/lib/worldLabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: unknown; sceneId?: unknown };
    const sceneId = typeof body.sceneId === "string" ? body.sceneId : "";
    const prompt = typeof body.prompt === "string" ? body.prompt : undefined;

    if (!sceneId) {
      return NextResponse.json({ error: "sceneId is required." }, { status: 400 });
    }

    return NextResponse.json(await generateWorldLabsScene(sceneId, prompt));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start World Labs generation." },
      { status: 500 }
    );
  }
}
