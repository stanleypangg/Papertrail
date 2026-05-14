import { NextResponse } from "next/server";

import { DEFAULT_WORLD_LABS_MODEL, generateWorldLabsScene, WORLD_LABS_MODELS, type WorldLabsModel } from "@/lib/worldLabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { model?: unknown; prompt?: unknown; sceneId?: unknown };
    const sceneId = typeof body.sceneId === "string" ? body.sceneId : "";
    const model = parseWorldLabsModel(body.model);
    const prompt = typeof body.prompt === "string" ? body.prompt : undefined;

    if (!sceneId) {
      return NextResponse.json({ error: "sceneId is required." }, { status: 400 });
    }

    return NextResponse.json(await generateWorldLabsScene(sceneId, prompt, model));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start World Labs generation." },
      { status: 500 }
    );
  }
}

function parseWorldLabsModel(value: unknown): WorldLabsModel {
  return WORLD_LABS_MODELS.some((model) => model.value === value)
    ? value as WorldLabsModel
    : DEFAULT_WORLD_LABS_MODEL;
}
