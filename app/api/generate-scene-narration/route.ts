import { NextResponse } from "next/server";

import { getCachedSceneNarration } from "@/lib/sceneNarration";
import { scenePlanSchema } from "@/lib/sceneSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { force?: unknown; scene?: unknown };
    const parsed = scenePlanSchema.safeParse(body.scene);

    if (!parsed.success) {
      return NextResponse.json(
        {
          audioUrl: null,
          captions: [],
          error: "Invalid scene payload."
        },
        { status: 400 }
      );
    }

    const { cacheState, ...narration } = await getCachedSceneNarration(parsed.data, {
      force: body.force === true
    });

    return NextResponse.json(narration, {
      headers: {
        "x-papertrail-narration-cache": cacheState
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        audioUrl: null,
        captions: [],
        error: error instanceof Error ? error.message : "Scene narration failed."
      },
      { status: 500 }
    );
  }
}
