import { NextResponse } from "next/server";

import { cacheWorldLabsSplat } from "@/lib/worldLabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { operationId?: unknown; prompt?: unknown; sceneId?: unknown; splatUrl?: unknown };
    const operationId = typeof body.operationId === "string" ? body.operationId : undefined;
    const prompt = typeof body.prompt === "string" ? body.prompt : undefined;
    const sceneId = typeof body.sceneId === "string" ? body.sceneId : "";
    const splatUrl = typeof body.splatUrl === "string" ? body.splatUrl : "";

    if (!sceneId || !splatUrl) {
      return NextResponse.json({ error: "sceneId and splatUrl are required." }, { status: 400 });
    }

    return NextResponse.json(await cacheWorldLabsSplat(sceneId, splatUrl, { operationId, prompt }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not cache World Labs splat." },
      { status: 500 }
    );
  }
}
