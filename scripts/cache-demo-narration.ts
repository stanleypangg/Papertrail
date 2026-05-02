import { demoScenes } from "@/lib/demoData";
import { prepareSceneNarrations } from "@/lib/sceneNarration";

async function main() {
  const result = await prepareSceneNarrations(demoScenes, { mode: "demo-cache-build" });

  for (const warning of result.warnings) {
    console.warn(warning);
  }

  console.log(`Cached narration for ${result.scenes.length} demo scene${result.scenes.length === 1 ? "" : "s"}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
