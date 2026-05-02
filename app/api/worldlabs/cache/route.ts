import { NextResponse } from "next/server";

import { cacheWorldLabsAssets, cacheWorldLabsCollider } from "@/lib/worldLabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { colliderOnly?: unknown; colliderUrl?: unknown; operationId?: unknown; prompt?: unknown; sceneId?: unknown; splatUrl?: unknown; worldId?: unknown };
    const colliderOnly = body.colliderOnly === true;
    const colliderUrl = typeof body.colliderUrl === "string" ? body.colliderUrl : undefined;
    const operationId = typeof body.operationId === "string" ? body.operationId : undefined;
    const prompt = typeof body.prompt === "string" ? body.prompt : undefined;
    const sceneId = typeof body.sceneId === "string" ? body.sceneId : "";
    const splatUrl = typeof body.splatUrl === "string" ? body.splatUrl : "";
    const worldId = typeof body.worldId === "string" ? body.worldId : undefined;

    if (colliderOnly) {
      if (!sceneId || (!colliderUrl && !operationId && !worldId)) {
        return NextResponse.json({ error: "sceneId and colliderUrl, operationId, or worldId are required." }, { status: 400 });
      }

      return NextResponse.json(await cacheWorldLabsCollider(sceneId, { colliderUrl, operationId, worldId }));
    }

    if (!sceneId || (!splatUrl && !operationId && !worldId)) {
      return NextResponse.json({ error: "sceneId and splatUrl, operationId, or worldId are required." }, { status: 400 });
    }

    return NextResponse.json(await cacheWorldLabsAssets(sceneId, { colliderUrl, operationId, prompt, splatUrl, worldId }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not cache World Labs splat." },
      { status: 500 }
    );
  }
}
