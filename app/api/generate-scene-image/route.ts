import { NextResponse } from "next/server";

import { generateSceneConceptImage } from "@/lib/imageGeneration";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mode?: unknown; prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const mode = body.mode === "scene-mural" ? "scene-mural" : "preview";

    if (!prompt) {
      return NextResponse.json({ imageUrl: null, warning: "No prompt provided." });
    }

    const imageUrl = await generateSceneConceptImage(prompt, { mode });

    return NextResponse.json({
      imageUrl,
      warning: imageUrl ? undefined : "OPENAI_API_KEY missing or no image returned; skipped scene mural."
    });
  } catch (error) {
    return NextResponse.json({
      imageUrl: null,
      warning: error instanceof Error ? error.message : "Image generation failed."
    });
  }
}
