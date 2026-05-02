import { NextResponse } from "next/server";

import { generateObjectModelsWithMeshy } from "@/lib/meshy";
import { scenesResponseSchema } from "@/lib/sceneSchema";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { scenes?: unknown };
    const parsed = scenesResponseSchema.safeParse({ scenes: body.scenes });

    if (!parsed.success) {
      return NextResponse.json(
        { models: {}, warnings: ["Invalid scene data; using primitive objects."] },
        { status: 400 }
      );
    }

    return NextResponse.json(await generateObjectModelsWithMeshy(parsed.data.scenes));
  } catch (error) {
    return NextResponse.json({
      models: {},
      warnings: [error instanceof Error ? error.message : "Meshy object generation failed; using primitive objects."]
    });
  }
}
