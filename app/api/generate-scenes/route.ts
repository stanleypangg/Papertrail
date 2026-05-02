import { NextResponse } from "next/server";

import { generateScenesWithBackboard } from "@/lib/backboard";
import { demoScenes } from "@/lib/demoData";

type GenerateSource = "backboard" | "demo";

export async function POST(request: Request) {
  let text = "";

  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.slice(0, 20_000) : "";

    if (!text.trim()) {
      return NextResponse.json({ scenes: demoScenes, source: "demo" satisfies GenerateSource, warning: "No text provided; using demo data." });
    }
  } catch {
    return NextResponse.json({ scenes: demoScenes, source: "demo" satisfies GenerateSource, warning: "Invalid JSON body; using demo data." });
  }

  const warnings: string[] = [];

  try {
    const scenes = await generateScenesWithBackboard(text);
    return NextResponse.json({ scenes, source: "backboard" satisfies GenerateSource, warnings });
  } catch (error) {
    warnings.push(`Backboard failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  return NextResponse.json({
    scenes: demoScenes,
    source: "demo" satisfies GenerateSource,
    warnings
  });
}
