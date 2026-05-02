import { NextResponse } from "next/server";

import { parsePdfBuffer } from "@/lib/pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a PDF file under the 'file' field." }, { status: 400 });
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF uploads are supported for this MVP." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parsePdfBuffer(Buffer.from(arrayBuffer));

    if (!parsed.text) {
      return NextResponse.json({ error: "No extractable text was found in this PDF." }, { status: 422 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF parsing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
