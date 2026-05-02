import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { demoScenes } from "./demoData";

const WORLD_LABS_API_URL = "https://api.worldlabs.ai/marble/v1";
const WORLD_LABS_MODEL = "marble-1.0-draft";
const DEMO_SPLAT_DIR = path.join(process.cwd(), "public", "splats", "demo");
const DEMO_SPLAT_MANIFEST = path.join(DEMO_SPLAT_DIR, "manifest.json");

type GenerateWorldResponse = {
  operation_id?: unknown;
  name?: unknown;
};

type OperationResponse = {
  operation_id?: unknown;
  done?: unknown;
  error?: unknown;
  metadata?: unknown;
  response?: unknown;
  result?: unknown;
};

type CachedSplatManifest = Record<string, {
  cachedAt: string;
  latestVersion: string;
  path: string;
  prompt?: string;
  sourceUrl: string;
  versions: Array<{
    bytes: number;
    cachedAt: string;
    operationId?: string;
    path: string;
    prompt?: string;
    sourceUrl: string;
    version: string;
  }>;
}>;

export type WorldLabsScene = {
  id: string;
  title: string;
  prompt: string;
  cachedPath: string | null;
  latestVersion: string | null;
  versions: Array<{
    bytes: number;
    cachedAt: string;
    operationId?: string;
    path: string;
    prompt?: string;
    sourceUrl: string;
    version: string;
  }>;
};

export type WorldLabsOperationStatus = {
  done: boolean;
  error: string | null;
  metadata: unknown;
  operationId: string;
  raw: unknown;
  splatUrls: string[];
  worldId: string | null;
};

export async function listWorldLabsDemoScenes(): Promise<WorldLabsScene[]> {
  const manifest = await readCachedSplatManifest();

  return demoScenes.map((scene) => ({
    id: scene.id,
    title: scene.title,
    prompt: scene.integrations?.walkableWorld?.prompt ?? scene.stylePrompt,
    cachedPath: manifest[scene.id]?.path ?? null,
    latestVersion: manifest[scene.id]?.latestVersion ?? null,
    versions: manifest[scene.id]?.versions ?? []
  }));
}

export function getWorldLabsDemoScene(sceneId: string) {
  return demoScenes.find((scene) => scene.id === sceneId) ?? null;
}

export async function generateWorldLabsScene(sceneId: string, customPrompt?: string): Promise<{ operationId: string; raw: unknown }> {
  const apiKey = getWorldLabsApiKey();
  const scene = getWorldLabsDemoScene(sceneId);

  if (!scene) {
    throw new Error("Unknown demo scene.");
  }

  const prompt = customPrompt?.trim() || scene.integrations?.walkableWorld?.prompt || scene.stylePrompt;
  const response = await fetch(`${WORLD_LABS_API_URL}/worlds:generate`, {
    method: "POST",
    headers: worldLabsHeaders(apiKey),
    body: JSON.stringify({
      display_name: `pageworld-demo-${scene.id}`.slice(0, 64),
      model: WORLD_LABS_MODEL,
      permission: {
        public: false
      },
      tags: ["pageworld", "demo", scene.id.slice(0, 32)],
      world_prompt: {
        type: "text",
        text_prompt: prompt,
        disable_recaption: true
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`World Labs generate failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const body = await response.json() as GenerateWorldResponse;
  const operationId = stringValue(body.operation_id) || stringValue(body.name);

  if (!operationId) {
    throw new Error("World Labs did not return an operation id.");
  }

  return { operationId, raw: body };
}

export async function getWorldLabsOperation(operationId: string): Promise<WorldLabsOperationStatus> {
  const apiKey = getWorldLabsApiKey();
  const response = await fetch(`${WORLD_LABS_API_URL}/operations/${encodeURIComponent(operationId)}`, {
    headers: worldLabsHeaders(apiKey),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`World Labs poll failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const body = await response.json() as OperationResponse;
  const result = body.response ?? body.result ?? null;

  return {
    done: body.done === true,
    error: readOperationError(body.error),
    metadata: body.metadata ?? null,
    operationId,
    raw: body,
    splatUrls: extractSplatUrls(result),
    worldId: readWorldId(result)
  };
}

export async function cacheWorldLabsSplat(
  sceneId: string,
  splatUrl: string,
  options: { operationId?: string; prompt?: string } = {}
) {
  const scene = getWorldLabsDemoScene(sceneId);

  if (!scene) {
    throw new Error("Unknown demo scene.");
  }

  if (!isHttpUrl(splatUrl)) {
    throw new Error("Splat URL must be an http(s) URL.");
  }

  const response = await fetch(splatUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not download splat (${response.status}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = extensionFromUrl(splatUrl) ?? ".splat";
  const cachedAt = new Date().toISOString();
  const version = createSplatVersion(cachedAt, options.operationId);
  const fileName = `pageworld-${scene.id}-${version}${extension}`;
  const filePath = path.join(DEMO_SPLAT_DIR, fileName);
  const publicPath = `/splats/demo/${fileName}`;
  const manifest = await readCachedSplatManifest();

  await mkdir(DEMO_SPLAT_DIR, { recursive: true });
  await writeFile(filePath, bytes);

  const versionEntry = {
    bytes: bytes.byteLength,
    cachedAt,
    operationId: options.operationId,
    path: publicPath,
    prompt: options.prompt,
    sourceUrl: splatUrl,
    version
  };
  const previousVersions = manifest[scene.id]?.versions ?? [];

  manifest[scene.id] = {
    cachedAt,
    latestVersion: version,
    path: publicPath,
    prompt: options.prompt,
    sourceUrl: splatUrl,
    versions: [versionEntry, ...previousVersions]
  };

  await writeFile(DEMO_SPLAT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    bytes: bytes.byteLength,
    path: publicPath,
    version
  };
}

function getWorldLabsApiKey(): string {
  const apiKey = process.env.WLT_API_KEY ?? process.env.WORLDLABS_API_KEY;

  if (!apiKey) {
    throw new Error("WLT_API_KEY is missing. Add it to .env.local.");
  }

  return apiKey;
}

function worldLabsHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "WLT-Api-Key": apiKey
  };
}

async function readCachedSplatManifest(): Promise<CachedSplatManifest> {
  try {
    const contents = await readFile(DEMO_SPLAT_MANIFEST, "utf8");
    const parsed = JSON.parse(contents) as CachedSplatManifest;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function extractSplatUrls(value: unknown): string[] {
  const urls = new Set<string>();
  collectSplatUrls(value, urls);
  return Array.from(urls);
}

function collectSplatUrls(value: unknown, urls: Set<string>) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectSplatUrls(item, urls));
    return;
  }

  const record = value as Record<string, unknown>;

  for (const [key, candidate] of Object.entries(record)) {
    if (typeof candidate === "string" && isHttpUrl(candidate) && looksLikeSplatKeyOrUrl(key, candidate)) {
      urls.add(candidate);
    } else if (candidate && typeof candidate === "object") {
      collectSplatUrls(candidate, urls);
    }
  }
}

function looksLikeSplatKeyOrUrl(key: string, url: string): boolean {
  const normalizedKey = key.toLowerCase();
  const normalizedUrl = url.toLowerCase().split("?")[0];

  return normalizedKey.includes("splat")
    || normalizedKey.includes("spz")
    || normalizedUrl.endsWith(".splat")
    || normalizedUrl.endsWith(".spz")
    || normalizedUrl.includes("splat");
}

function readWorldId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return stringValue(record.world_id) || stringValue(record.id) || null;
}

function readOperationError(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return stringValue(record.message) || stringValue(record.detail) || JSON.stringify(value);
  }

  return String(value);
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".spz")) {
      return ".spz";
    }

    if (pathname.endsWith(".splat")) {
      return ".splat";
    }
  } catch {
    return null;
  }

  return null;
}

function createSplatVersion(cachedAt: string, operationId?: string): string {
  const timestamp = cachedAt.replace(/\D/g, "").slice(0, 14);
  const operationSuffix = operationId ? `-${operationId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}` : "";

  return `v${timestamp}${operationSuffix}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
