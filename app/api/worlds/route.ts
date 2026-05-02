import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { saveWorld } from "@/lib/worldStore";
import { createWorldPayloadSchema } from "@/lib/worldSchema";

export async function POST(request: Request) {
  try {
    const payload = createWorldPayloadSchema.parse(await request.json());
    const world = saveWorld(payload);

    return NextResponse.json({
      id: world.id,
      joinCode: world.joinCode,
      path: `/world/${world.joinCode}`
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid world payload." }, { status: 400 });
    }

    return NextResponse.json({ error: "Could not save world." }, { status: 500 });
  }
}
