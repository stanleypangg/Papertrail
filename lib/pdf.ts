import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_PDF_TEXT_CHARS = 20_000;

export type ParsedPdf = {
  text: string;
  charCount: number;
  truncated: boolean;
  warning?: string;
};

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPdf> {
  await installPdfWorker();
  const pdfParse = await import("pdf-parse");
  let text = "";

  if ("PDFParse" in pdfParse) {
    const parser = new pdfParse.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = result.text ?? "";
    } finally {
      await parser.destroy();
    }
  } else {
    const parse = (pdfParse as unknown as { default: (input: Buffer) => Promise<{ text?: string }> }).default;
    const result = await parse(buffer);
    text = result.text ?? "";
  }

  const cleanText = text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  const truncated = cleanText.length > MAX_PDF_TEXT_CHARS;

  return {
    text: truncated ? cleanText.slice(0, MAX_PDF_TEXT_CHARS) : cleanText,
    charCount: cleanText.length,
    truncated,
    warning: truncated
      ? `PDF text was truncated to ${MAX_PDF_TEXT_CHARS.toLocaleString()} characters for the MVP.`
      : undefined
  };
}

async function installPdfWorker() {
  const globalWithWorker = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler: unknown };
  };

  if (globalWithWorker.pdfjsWorker?.WorkerMessageHandler) {
    return;
  }

  const workerPath = path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs");
  const importAtRuntime = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<unknown>;
  const workerModule = (await importAtRuntime(pathToFileURL(workerPath).href)) as {
    WorkerMessageHandler: unknown;
  };

  globalWithWorker.pdfjsWorker = {
    WorkerMessageHandler: workerModule.WorkerMessageHandler
  };
}
