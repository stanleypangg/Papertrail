import { NextResponse } from "next/server";

import { getWorldLabsOperation } from "@/lib/worldLabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ operationId?: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { operationId } = await params;

    if (!operationId) {
      return NextResponse.json({ error: "operationId is required." }, { status: 400 });
    }

    return NextResponse.json(await getWorldLabsOperation(operationId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not poll World Labs generation." },
      { status: 500 }
    );
  }
}
