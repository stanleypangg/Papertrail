import { emptyObjectModelMap, type GeneratedObjectModel, type GenerateObjectModelsResponse } from "./objectModels";
import type { SceneObject, ScenePlan } from "./sceneSchema";

const MESHY_TEXT_TO_3D_URL = "https://api.meshy.ai/openapi/v2/text-to-3d";
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_CONCURRENCY = 3;
const POLL_INTERVAL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PROMPT_CHARS = 600;

type ObjectJob = {
  scene: ScenePlan;
  object: SceneObject;
};

export type MeshyObjectProgress = {
  sceneId: string;
  sceneTitle: string;
  objectId: string;
  objectLabel: string;
  taskId?: string;
  providerProgress: number | null;
  status: string;
};

type MeshyGenerationOptions = {
  onProgress?: (progress: MeshyObjectProgress) => void;
};

type MeshyCreateResponse = {
  result?: unknown;
};

type MeshyTaskResponse = {
  status?: unknown;
  progress?: unknown;
  model_urls?: {
    glb?: unknown;
  };
  task_error?: {
    message?: unknown;
  };
};

export async function generateObjectModelsWithMeshy(
  scenes: ScenePlan[],
  options: MeshyGenerationOptions = {}
): Promise<GenerateObjectModelsResponse> {
  const apiKey = process.env.MESHY_API_KEY;

  if (!apiKey) {
    return {
      models: emptyObjectModelMap(scenes, "skipped", "MESHY_API_KEY missing; using primitive objects."),
      warnings: ["MESHY_API_KEY missing; using primitive objects."]
    };
  }

  const timeoutMs = positiveIntegerFromEnv("MESHY_OBJECT_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const concurrency = positiveIntegerFromEnv("MESHY_OBJECT_CONCURRENCY", DEFAULT_CONCURRENCY);
  const deadline = Date.now() + timeoutMs;
  const jobs = scenes.flatMap((scene) => scene.objects.map((object) => ({ scene, object })));
  const results = await runWithConcurrency(jobs, concurrency, (job) => generateObjectModel(apiKey, job, deadline, options));
  const models = emptyObjectModelMap(scenes, "skipped");
  const warnings: string[] = [];

  for (const result of results) {
    models[result.sceneId][result.objectId] = result.model;

    if (result.model.warning) {
      warnings.push(`${result.sceneTitle} ${result.objectLabel}: ${result.model.warning}`);
    }
  }

  return { models, warnings };
}

async function generateObjectModel(
  apiKey: string,
  job: ObjectJob,
  deadline: number,
  options: MeshyGenerationOptions
): Promise<{ sceneId: string; sceneTitle: string; objectId: string; objectLabel: string; model: GeneratedObjectModel }> {
  const base = {
    sceneId: job.scene.id,
    sceneTitle: job.scene.title,
    objectId: job.object.id,
    objectLabel: job.object.label
  };

  if (Date.now() >= deadline) {
    return { ...base, model: { modelUrl: null, status: "timeout", warning: "Meshy generation timed out." } };
  }

  try {
    const createResponse = await fetchWithDeadline(
      MESHY_TEXT_TO_3D_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "preview",
          prompt: buildObjectPrompt(job.scene, job.object),
          art_style: "realistic",
          should_remesh: true,
          symmetry_mode: "auto",
          moderation: true
        })
      },
      deadline
    );

    if (!createResponse.ok) {
      const detail = await createResponse.text();
      return {
        ...base,
        model: {
          modelUrl: null,
          status: "failed",
          warning: `Meshy create failed (${createResponse.status}): ${detail.slice(0, 180)}`
        }
      };
    }

    const created = (await createResponse.json()) as MeshyCreateResponse;
    const taskId = typeof created.result === "string" ? created.result : "";

    if (!taskId) {
      return {
        ...base,
        model: { modelUrl: null, status: "failed", warning: "Meshy did not return a task id." }
      };
    }

    options.onProgress?.({ ...base, taskId, providerProgress: 0, status: "PENDING" });

    return {
      ...base,
      model: await streamMeshyTask(apiKey, taskId, deadline, (task) => {
        options.onProgress?.({ ...base, ...task });
      })
    };
  } catch (error) {
    const timedOut = Date.now() >= deadline || (error instanceof Error && error.name === "AbortError");
    return {
      ...base,
      model: {
        modelUrl: null,
        status: timedOut ? "timeout" : "failed",
        warning: timedOut ? "Meshy generation timed out." : error instanceof Error ? error.message : "Meshy generation failed."
      }
    };
  }
}

async function streamMeshyTask(
  apiKey: string,
  taskId: string,
  deadline: number,
  onProgress?: (progress: Pick<MeshyObjectProgress, "taskId" | "providerProgress" | "status">) => void
): Promise<GeneratedObjectModel> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));

  try {
    const response = await fetch(`${MESHY_TEXT_TO_3D_URL}/${taskId}/stream`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      return await pollMeshyTask(apiKey, taskId, deadline, onProgress);
    }

    const result = await readMeshyTaskStream(response.body, taskId, onProgress);

    return result ?? (await pollMeshyTask(apiKey, taskId, deadline, onProgress));
  } catch {
    return await pollMeshyTask(apiKey, taskId, deadline, onProgress);
  } finally {
    clearTimeout(timeout);
  }
}

async function pollMeshyTask(
  apiKey: string,
  taskId: string,
  deadline: number,
  onProgress?: (progress: Pick<MeshyObjectProgress, "taskId" | "providerProgress" | "status">) => void
): Promise<GeneratedObjectModel> {
  while (Date.now() < deadline) {
    const response = await fetchWithDeadline(
      `${MESHY_TEXT_TO_3D_URL}/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      },
      deadline
    );

    if (!response.ok) {
      const detail = await response.text();
      return {
        modelUrl: null,
        taskId,
        status: "failed",
        warning: `Meshy status failed (${response.status}): ${detail.slice(0, 180)}`
      };
    }

    const task = (await response.json()) as MeshyTaskResponse;
    const status = typeof task.status === "string" ? task.status : "";
    onProgress?.({ taskId, providerProgress: readMeshyProgress(task.progress), status });

    if (status === "SUCCEEDED") {
      const modelUrl = typeof task.model_urls?.glb === "string" ? task.model_urls.glb : null;

      return modelUrl
        ? { modelUrl, taskId, status: "succeeded" }
        : { modelUrl: null, taskId, status: "failed", warning: "Meshy task succeeded without a GLB URL." };
    }

    if (status === "FAILED") {
      const message = typeof task.task_error?.message === "string" && task.task_error.message
        ? task.task_error.message
        : "Meshy task failed.";
      return { modelUrl: null, taskId, status: "failed", warning: message };
    }

    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
  }

  return { modelUrl: null, taskId, status: "timeout", warning: "Meshy generation timed out." };
}

async function readMeshyTaskStream(
  body: ReadableStream<Uint8Array>,
  taskId: string,
  onProgress?: (progress: Pick<MeshyObjectProgress, "taskId" | "providerProgress" | "status">) => void
): Promise<GeneratedObjectModel | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const separatorIndex = buffer.indexOf("\n\n");
      if (separatorIndex === -1) {
        break;
      }

      const frame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const result = readMeshyFrame(frame, taskId, onProgress);

      if (result) {
        return result;
      }
    }
  }

  const trailing = decoder.decode();
  if (trailing) {
    buffer += trailing;
  }

  if (buffer.trim()) {
    return readMeshyFrame(buffer, taskId, onProgress);
  }

  return null;
}

function readMeshyFrame(
  frame: string,
  taskId: string,
  onProgress?: (progress: Pick<MeshyObjectProgress, "taskId" | "providerProgress" | "status">) => void
): GeneratedObjectModel | null {
  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.join("\n");
  if (data === "[DONE]") {
    return null;
  }

  let task: MeshyTaskResponse;
  try {
    task = JSON.parse(data) as MeshyTaskResponse;
  } catch {
    return null;
  }

  const status = typeof task.status === "string" ? task.status : "";
  onProgress?.({ taskId, providerProgress: readMeshyProgress(task.progress), status });

  if (status === "SUCCEEDED") {
    const modelUrl = typeof task.model_urls?.glb === "string" ? task.model_urls.glb : null;

    return modelUrl
      ? { modelUrl, taskId, status: "succeeded" }
      : { modelUrl: null, taskId, status: "failed", warning: "Meshy task succeeded without a GLB URL." };
  }

  if (status === "FAILED") {
    const message = typeof task.task_error?.message === "string" && task.task_error.message
      ? task.task_error.message
      : "Meshy task failed.";
    return { modelUrl: null, taskId, status: "failed", warning: message };
  }

  return null;
}

function buildObjectPrompt(scene: ScenePlan, object: SceneObject): string {
  return truncatePrompt(
    [
      `Create one standalone 3D prop: ${object.label}.`,
      `Object category: ${object.visualType}.`,
      object.description,
      object.explanation,
      `Scene context: ${scene.title}. ${scene.dressing}`,
      "Make it readable as a single foreground object for a first-person story museum.",
      "No text, labels, captions, logos, base pedestal, environment, floor, wall, or background."
    ].join(" ")
  );
}

function truncatePrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_PROMPT_CHARS) {
    return normalized;
  }

  return normalized.slice(0, MAX_PROMPT_CHARS - 1).trimEnd();
}

async function fetchWithDeadline(input: RequestInfo | URL, init: RequestInit, deadline: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()))
  );

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));

  return results;
}

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readMeshyProgress(progress: unknown): number | null {
  const value = typeof progress === "number" ? progress : typeof progress === "string" ? Number.parseFloat(progress) : NaN;

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
