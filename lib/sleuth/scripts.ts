import { readFileSync } from "node:fs";
import path from "node:path";

import {
  type ScriptDefinition,
  scriptDefinitionSchema,
} from "@/lib/sleuth/scripts.types";

const SCRIPTS_DIR = path.join(process.cwd(), "data", "scripts");

export function loadScript(id: string): ScriptDefinition {
  const filePath = path.join(SCRIPTS_DIR, `${id}.json`);

  let rawText: string;
  try {
    rawText = readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Unknown Sleuth script: ${id}`);
    }
    throw error;
  }

  const parsed = JSON.parse(rawText) as unknown;
  return scriptDefinitionSchema.parse(parsed);
}
