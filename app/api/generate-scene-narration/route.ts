import { NextResponse } from "next/server";

import { generateSceneNarration } from "@/lib/sceneNarration";
import { scenePlanSchema } from "@/lib/sceneSchema";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { scene?: unknown };
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

    return NextResponse.json(await generateSceneNarration(parsed.data));
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
