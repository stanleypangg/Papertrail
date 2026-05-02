import { NextResponse } from "next/server";

import { generateSceneConceptImage } from "@/lib/imageGeneration";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ imageUrl: null, warning: "No prompt provided." });
    }

    const imageUrl = await generateSceneConceptImage(prompt);

    return NextResponse.json({
      imageUrl,
      warning: imageUrl ? undefined : "OPENAI_API_KEY missing or no image returned; skipped concept art."
    });
  } catch (error) {
    return NextResponse.json({
      imageUrl: null,
      warning: error instanceof Error ? error.message : "Image generation failed."
    });
  }
}

