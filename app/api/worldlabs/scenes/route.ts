import { NextResponse } from "next/server";

import { listWorldLabsDemoScenes } from "@/lib/worldLabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ scenes: await listWorldLabsDemoScenes() });
}
