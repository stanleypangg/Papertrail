import { demoScenes, demoSplatPreviewImages } from "@/lib/demoData";
import { generateSceneMuralImage } from "@/lib/imageGeneration";
import { generateObjectModelsWithMeshy } from "@/lib/meshy";
import { parsePdfBuffer } from "@/lib/pdf";
import { sceneImageKey, visibleSceneImages, type SceneImageMap } from "@/lib/sceneImages";
import type { ScenePlan } from "@/lib/sceneSchema";
import { prepareSceneNarrations } from "@/lib/sceneNarration";
import { generateScenesWithBackboardStreamed } from "@/lib/backboard";
import { saveWorld } from "@/lib/worldStore";
import type { GenerationStage, GenerationStatus, WorldGenerationEvent } from "@/lib/worldGenerationEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Emit = (event: WorldGenerationEvent) => void;

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (event) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await generateWorld(request, emit);
      } catch (error) {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : "World generation failed."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}

async function generateWorld(request: Request, emit: Emit) {
  emitProgress(emit, "initializing", "active", 4, "Opening the workshop", "Preparing the generation stream.");

  const formData = await request.formData();
  const mode = formData.get("mode") === "demo" ? "demo" : "pdf";
  const warnings: string[] = [];
  let scenes: ScenePlan[];
  let source = "unknown";

  if (mode === "demo") {
    scenes = demoScenes;
    source = "demo";
    emitProgress(emit, "planning", "complete", 42, "Demo scenes ready", "Loaded the built-in PageWorld scene chain.", "Loaded demo scenes.");
  } else {
    const parsed = await parseUploadedPdf(formData, emit);
    warnings.push(...parsed.warnings);

    const planned = await planScenes(parsed.text, emit);
    scenes = planned.scenes;
    source = planned.source;
    warnings.push(...planned.warnings);
  }

  const useStaticDemoAssets = source === "demo";
  const narrationResult = await generateNarrations(scenes, emit, { useDemoCache: useStaticDemoAssets });
  scenes = narrationResult.scenes;
  warnings.push(...narrationResult.warnings);

  const imageResult = useStaticDemoAssets ? generateDemoImages(scenes, emit) : await generateImages(scenes, emit);
  warnings.push(...imageResult.warnings);

  const objectModelResult = useStaticDemoAssets ? createPrimitiveDemoObjects(emit) : await generateObjectModels(scenes, emit);
  warnings.push(...objectModelResult.warnings);

  emitProgress(emit, "saving", "active", 96, "Saving VR link", "Creating a shareable world for headset handoff.");
  const world = saveWorld({
    scenes,
    sceneImages: visibleSceneImages(scenes, imageResult.images),
    objectModels: objectModelResult.models,
    source,
    warnings
  });
  emitProgress(emit, "saving", "complete", 98, "VR link ready", "The generated world is stored for this session.", "Created the headset link.");

  emitProgress(emit, "complete", "complete", 100, "World assembled", "Opening the scene chain.");
  emit({
    type: "complete",
    scenes,
    sceneImages: imageResult.images,
    objectModels: objectModelResult.models,
    source,
    warnings,
    sharePath: `/world/${world.joinCode}`,
    joinCode: world.joinCode
  });
}

async function parseUploadedPdf(formData: FormData, emit: Emit): Promise<{ text: string; warnings: string[] }> {
  emitProgress(emit, "parsing", "active", 10, "Reading the PDF", "Extracting source text and page anchors.");

  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Upload a PDF file under the 'file' field.");
  }

  if (file.type && file.type !== "application/pdf") {
    throw new Error("Only PDF uploads are supported for this MVP.");
  }

  const parsed = await parsePdfBuffer(Buffer.from(await file.arrayBuffer()));

  if (!parsed.text) {
    throw new Error("No extractable text was found in this PDF.");
  }

  const warnings = parsed.warning ? [parsed.warning] : [];
  emitProgress(
    emit,
    "parsing",
    warnings.length > 0 ? "warning" : "complete",
    22,
    "PDF text extracted",
    `Found ${parsed.text.length.toLocaleString()} characters to shape into scenes.`,
    "Extracted PDF text."
  );

  return { text: parsed.text, warnings };
}

async function planScenes(
  text: string,
  emit: Emit
): Promise<{ scenes: ScenePlan[]; source: string; warnings: string[] }> {
  emitProgress(emit, "planning", "active", 28, "Planning the scene chain", "Finding locations, objects, quotes, and transitions.");

  const warnings: string[] = [];
  let streamedCharacters = 0;
  let lastProgressAt = 0;

  try {
    const scenes = await generateScenesWithBackboardStreamed(text.slice(0, 20_000), {
      onChunk: (chunk) => {
        streamedCharacters += chunk.length;

        if (Date.now() - lastProgressAt < 650) {
          return;
        }

        lastProgressAt = Date.now();
        emitProgress(
          emit,
          "planning",
          "active",
          Math.min(40, 30 + Math.floor(streamedCharacters / 240)),
          "Planning the scene chain",
          "Backboard is drafting structured scene JSON.",
          "Receiving scene-planner tokens."
        );
      }
    });

    emitProgress(
      emit,
      "planning",
      "complete",
      42,
      "Scene chain planned",
      `Built ${scenes.length} scene${scenes.length === 1 ? "" : "s"} from the document.`,
      `Planned ${scenes.length} scenes.`
    );

    return { scenes, source: "backboard", warnings };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    warnings.push(`Backboard failed: ${detail}`);
    emitProgress(
      emit,
      "planning",
      "warning",
      42,
      "Using demo scene fallback",
      "Backboard was unavailable, so PageWorld kept the demo playable.",
      "Backboard failed; loaded demo scenes."
    );

    return { scenes: demoScenes, source: "demo", warnings };
  }
}

async function generateNarrations(
  scenes: ScenePlan[],
  emit: Emit,
  options: { useDemoCache: boolean }
): Promise<{ scenes: ScenePlan[]; warnings: string[] }> {
  const targetCount = options.useDemoCache ? scenes.length : Math.max(0, scenes.length - 1);

  if (targetCount === 0) {
    emitProgress(emit, "narration", "complete", 54, "Narration ready", "Only the opening scene is present.", "Skipped narration prewarm.");
    return { scenes, warnings: [] };
  }

  emitProgress(
    emit,
    "narration",
    "active",
    44,
    options.useDemoCache ? "Loading demo narration" : "Narrating later scenes",
    options.useDemoCache
      ? `Loading ${targetCount} cached demo narration asset${targetCount === 1 ? "" : "s"}.`
      : `Preparing ${targetCount} longer scene narration${targetCount === 1 ? "" : "s"}.`
  );

  const result = await prepareSceneNarrations(scenes, {
    mode: options.useDemoCache ? "demo-readonly" : "runtime",
    onProgress: (progress) => {
      const percent = 44 + Math.round((progress.completed / Math.max(1, progress.total)) * 10);
      emitProgress(
        emit,
        "narration",
        progress.completed === progress.total && progress.warning ? "warning" : progress.completed === progress.total ? "complete" : "active",
        percent,
        options.useDemoCache ? "Loading demo narration" : "Narrating later scenes",
        `${progress.completed} of ${progress.total} narrations ready.`,
        `Prepared narration for ${progress.scene.title}.`
      );
    }
  });

  emitProgress(
    emit,
    "narration",
    result.warnings.length > 0 ? "warning" : "complete",
    54,
    "Narration ready",
    result.warnings.length > 0
      ? "Some scenes will use generated captions without audio."
      : options.useDemoCache ? "Cached demo narration is ready." : "Later scenes are ready to play quickly.",
    "Finished narration prewarm."
  );

  return result;
}

async function generateImages(scenes: ScenePlan[], emit: Emit): Promise<{ images: SceneImageMap; warnings: string[] }> {
  emitProgress(emit, "images", "active", 46, "Painting scene murals", `Generating ${scenes.length} wall mural${scenes.length === 1 ? "" : "s"}.`);

  const images: SceneImageMap = {};
  const warnings: string[] = [];
  let completed = 0;

  await Promise.all(
    scenes.map(async (scene) => {
      const imageKey = sceneImageKey(scene);

      try {
        const imageUrl = await generateSceneMuralImage(scene);
        const warning = imageUrl ? undefined : "OPENAI_API_KEY missing or no image returned; skipped scene mural.";
        images[imageKey] = imageUrl;

        if (warning) {
          warnings.push(`${scene.title}: ${warning}`);
        }

        emit({ type: "image-complete", sceneId: scene.id, imageKey, imageUrl, warning });
      } catch (error) {
        const warning = error instanceof Error ? error.message : `Could not generate a scene mural for ${scene.title}.`;
        images[imageKey] = null;
        warnings.push(`${scene.title}: ${warning}`);
        emit({ type: "image-complete", sceneId: scene.id, imageKey, imageUrl: null, warning });
      } finally {
        completed += 1;
        const percent = 46 + Math.round((completed / scenes.length) * 22);
        emitProgress(
          emit,
          "images",
          completed === scenes.length && warnings.length > 0 ? "warning" : completed === scenes.length ? "complete" : "active",
          percent,
          "Painting environments",
          `${completed} of ${scenes.length} environments ready.`,
          `Painted environment for ${scene.title}.`
        );
      }
    })
  );

  return { images, warnings };
}

function generateDemoImages(scenes: ScenePlan[], emit: Emit): { images: SceneImageMap; warnings: string[] } {
  emitProgress(emit, "images", "active", 54, "Loading cached previews", "Using the built-in splat previews for the demo world.");

  const images = Object.fromEntries(scenes.map((scene) => {
    const imageKey = sceneImageKey(scene);
    const imageUrl = demoSplatPreviewImages[scene.id] ?? null;
    emit({ type: "image-complete", sceneId: scene.id, imageKey, imageUrl });

    return [imageKey, imageUrl];
  })) as SceneImageMap;

  emitProgress(emit, "images", "complete", 68, "Demo previews ready", "Cached splat previews are ready.", "Loaded cached demo previews.");

  return { images, warnings: [] };
}

function createPrimitiveDemoObjects(emit: Emit) {
  emitProgress(emit, "models", "active", 80, "Preparing primitive objects", "Using deterministic primitives for the demo interactables.");
  emitProgress(emit, "models", "complete", 94, "Interactables ready", "Demo objects will render as primitive geometry.", "Loaded primitive demo objects.");

  return { models: {}, warnings: [] };
}

async function generateObjectModels(scenes: ScenePlan[], emit: Emit) {
  const objectCount = scenes.reduce((total, scene) => total + scene.objects.length, 0);
  const progressByObject = new Map<string, number>();

  emitProgress(emit, "models", "active", 70, "Sculpting interactables", `Preparing ${objectCount} source-grounded object${objectCount === 1 ? "" : "s"}.`);

  const result = await generateObjectModelsWithMeshy(scenes, {
    onProgress: (progress) => {
      const key = `${progress.sceneId}:${progress.objectId}`;
      progressByObject.set(key, progress.providerProgress ?? progressByObject.get(key) ?? 0);

      const averageProgress = objectCount > 0
        ? Array.from(progressByObject.values()).reduce((total, value) => total + value, 0) / objectCount
        : 100;
      const percent = 70 + Math.round((Math.min(100, averageProgress) / 100) * 22);

      emit({
        type: "model-progress",
        sceneId: progress.sceneId,
        objectId: progress.objectId,
        label: progress.objectLabel,
        taskId: progress.taskId,
        providerProgress: progress.providerProgress,
        status: progress.status
      });
      emitProgress(
        emit,
        "models",
        "active",
        percent,
        "Sculpting interactables",
        `${progress.objectLabel}: ${humanizeProviderStatus(progress.status, progress.providerProgress)}`,
        `Updated ${progress.objectLabel}.`
      );
    }
  });

  for (const scene of scenes) {
    for (const object of scene.objects) {
      const model = result.models[scene.id]?.[object.id];

      if (model) {
        emit({ type: "model-complete", sceneId: scene.id, objectId: object.id, model });
      }
    }
  }

  emitProgress(
    emit,
    "models",
    result.warnings.length > 0 ? "warning" : "complete",
    94,
    "Interactables ready",
    result.warnings.length > 0 ? "Some objects will use primitive fallback geometry." : "All object jobs finished.",
    "Finished object generation."
  );

  return result;
}

function emitProgress(
  emit: Emit,
  stage: GenerationStage,
  status: GenerationStatus,
  percent: number,
  title: string,
  detail?: string,
  log?: string
) {
  emit({
    type: "progress",
    stage,
    status,
    percent: Math.max(0, Math.min(100, percent)),
    title,
    detail,
    log
  });
}

function humanizeProviderStatus(status: string, progress: number | null): string {
  if (progress !== null) {
    return `${Math.round(progress)}%`;
  }

  return status ? status.toLowerCase().replaceAll("_", " ") : "working";
}
