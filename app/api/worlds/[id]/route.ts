import { NextResponse } from "next/server";

import { getWorld } from "@/lib/worldStore";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id?: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "World id is required." }, { status: 400 });
  }

  const world = getWorld(id);

  if (!world) {
    return NextResponse.json({ error: "World not found." }, { status: 404 });
  }

  return NextResponse.json({ world });
}
