import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { demoScenes } from "./demoData";

const WORLD_LABS_API_URL = "https://api.worldlabs.ai/marble/v1";
export const WORLD_LABS_MODELS = [
  { label: "Marble 1.1 Plus", value: "marble-1.1-plus" },
  { label: "Marble 1.1", value: "marble-1.1" },
  { label: "Marble 1.0", value: "marble-1.0" },
  { label: "Marble 1.0 Draft", value: "marble-1.0-draft" }
] as const;
export type WorldLabsModel = typeof WORLD_LABS_MODELS[number]["value"];
export const DEFAULT_WORLD_LABS_MODEL: WorldLabsModel = "marble-1.0-draft";
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

type CachedSplatVersion = {
  bytes: number;
  cachedAt: string;
  colliderBytes?: number;
  colliderPath?: string;
  colliderSourceUrl?: string;
  operationId?: string;
  path: string;
  prompt?: string;
  sourceUrl: string;
  version: string;
  worldId?: string;
};

type CachedSplatManifest = Record<string, {
  cachedAt: string;
  colliderPath?: string;
  colliderSourceUrl?: string;
  latestVersion: string;
  path: string;
  prompt?: string;
  sourceUrl: string;
  versions: CachedSplatVersion[];
  worldId?: string;
}>;

type WorldLabsAssetUrls = {
  colliderUrl: string | null;
  splatUrl: string | null;
  splatUrls: string[];
  worldId: string | null;
  worldUrl: string | null;
};

export type WorldLabsScene = {
  id: string;
  title: string;
  prompt: string;
  cachedPath: string | null;
  colliderPath: string | null;
  latestVersion: string | null;
  versions: CachedSplatVersion[];
  worldId: string | null;
};

export type WorldLabsOperationStatus = {
  assets: WorldLabsAssetUrls;
  done: boolean;
  error: string | null;
  metadata: unknown;
  operationId: string;
  raw: unknown;
  colliderUrls: string[];
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
    colliderPath: manifest[scene.id]?.colliderPath ?? null,
    latestVersion: manifest[scene.id]?.latestVersion ?? null,
    versions: manifest[scene.id]?.versions ?? [],
    worldId: manifest[scene.id]?.worldId ?? null
  }));
}

export function getWorldLabsDemoScene(sceneId: string) {
  return demoScenes.find((scene) => scene.id === sceneId) ?? null;
}

export async function generateWorldLabsScene(
  sceneId: string,
  customPrompt?: string,
  model: WorldLabsModel = DEFAULT_WORLD_LABS_MODEL
): Promise<{ operationId: string; raw: unknown }> {
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
      model,
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
  const snapshot = body.response ?? body.result ?? null;
  const metadataWorldId = readWorldId(body.metadata);
  const snapshotWorldId = readWorldId(snapshot);
  const worldId = snapshotWorldId || metadataWorldId;
  const latestWorld = body.done === true && worldId ? await tryGetWorldLabsWorld(worldId) : null;
  const assets = normalizeWorldLabsAssets(latestWorld ?? snapshot, worldId);

  return {
    assets,
    done: body.done === true,
    error: readOperationError(body.error),
    metadata: body.metadata ?? null,
    operationId,
    raw: body,
    colliderUrls: assets.colliderUrl ? [assets.colliderUrl] : [],
    splatUrls: assets.splatUrls,
    worldId: assets.worldId
  };
}

export async function cacheWorldLabsSplat(
  sceneId: string,
  splatUrl: string,
  options: { colliderUrl?: string; operationId?: string; prompt?: string; worldId?: string } = {}
) {
  return cacheWorldLabsAssets(sceneId, {
    ...options,
    splatUrl
  });
}

export async function cacheWorldLabsAssets(
  sceneId: string,
  options: { colliderUrl?: string; operationId?: string; prompt?: string; splatUrl?: string; worldId?: string } = {}
) {
  const scene = getWorldLabsDemoScene(sceneId);

  if (!scene) {
    throw new Error("Unknown demo scene.");
  }

  const resolved = await resolveWorldLabsAssets(options);
  const splatUrl = options.splatUrl ?? resolved.splatUrl;
  const colliderUrl = options.colliderUrl ?? resolved.colliderUrl;
  const worldId = options.worldId ?? resolved.worldId ?? undefined;

  if (!splatUrl) {
    throw new Error("No World Labs splat URL found. Poll the operation again after it completes.");
  }

  const splat = await downloadRemoteAsset(splatUrl, "splat");
  const extension = extensionFromUrl(splatUrl) ?? ".spz";
  const cachedAt = new Date().toISOString();
  const version = createSplatVersion(cachedAt, options.operationId);
  const fileName = `pageworld-${scene.id}-${version}${extension}`;
  const filePath = path.join(DEMO_SPLAT_DIR, fileName);
  const publicPath = `/splats/demo/${fileName}`;
  const manifest = await readCachedSplatManifest();
  const collider = colliderUrl ? await downloadWorldLabsCollider(scene.id, version, colliderUrl) : null;

  await mkdir(DEMO_SPLAT_DIR, { recursive: true });
  await writeFile(filePath, splat.bytes);

  const versionEntry: CachedSplatVersion = {
    bytes: splat.bytes.byteLength,
    cachedAt,
    colliderBytes: collider?.bytes,
    colliderPath: collider?.path,
    colliderSourceUrl: collider?.sourceUrl,
    operationId: options.operationId,
    path: publicPath,
    prompt: options.prompt,
    sourceUrl: splatUrl,
    version,
    worldId
  };
  const previousVersions = manifest[scene.id]?.versions ?? [];

  manifest[scene.id] = {
    cachedAt,
    colliderPath: collider?.path ?? manifest[scene.id]?.colliderPath,
    colliderSourceUrl: collider?.sourceUrl ?? manifest[scene.id]?.colliderSourceUrl,
    latestVersion: version,
    path: publicPath,
    prompt: options.prompt,
    sourceUrl: splatUrl,
    versions: [versionEntry, ...previousVersions],
    worldId
  };

  await writeCachedSplatManifest(manifest);

  return {
    bytes: splat.bytes.byteLength,
    colliderPath: collider?.path ?? null,
    path: publicPath,
    version,
    worldId
  };
}

export async function cacheWorldLabsCollider(
  sceneId: string,
  options: { colliderUrl?: string; operationId?: string; worldId?: string } = {}
) {
  const scene = getWorldLabsDemoScene(sceneId);

  if (!scene) {
    throw new Error("Unknown demo scene.");
  }

  const manifest = await readCachedSplatManifest();
  const sceneManifest = manifest[scene.id];

  if (!sceneManifest) {
    throw new Error("Cache a splat before caching its collider mesh.");
  }

  const resolved = await resolveWorldLabsAssets({
    operationId: options.operationId,
    worldId: options.worldId ?? sceneManifest.worldId
  });
  const colliderUrl = options.colliderUrl ?? resolved.colliderUrl;

  if (!colliderUrl) {
    throw new Error("No collider mesh URL found for this scene.");
  }

  const collider = await downloadWorldLabsCollider(scene.id, sceneManifest.latestVersion, colliderUrl);
  const [latestVersion, ...otherVersions] = sceneManifest.versions;
  const nextLatestVersion = latestVersion ? {
    ...latestVersion,
    colliderBytes: collider.bytes,
    colliderPath: collider.path,
    colliderSourceUrl: collider.sourceUrl
  } : latestVersion;

  manifest[scene.id] = {
    ...sceneManifest,
    colliderPath: collider.path,
    colliderSourceUrl: collider.sourceUrl,
    versions: nextLatestVersion ? [nextLatestVersion, ...otherVersions] : sceneManifest.versions,
    worldId: options.worldId ?? resolved.worldId ?? sceneManifest.worldId
  };

  await writeCachedSplatManifest(manifest);

  return collider;
}

async function resolveWorldLabsAssets(options: { operationId?: string; worldId?: string }) {
  if (options.worldId) {
    const world = await tryGetWorldLabsWorld(options.worldId);
    if (world) {
      return normalizeWorldLabsAssets(world, options.worldId);
    }
  }

  if (options.operationId) {
    const operation = await getWorldLabsOperation(options.operationId);
    return operation.assets;
  }

  return normalizeWorldLabsAssets(null, null);
}

async function tryGetWorldLabsWorld(worldId: string) {
  const apiKey = getWorldLabsApiKey();
  const response = await fetch(`${WORLD_LABS_API_URL}/worlds/${encodeURIComponent(worldId)}`, {
    headers: worldLabsHeaders(apiKey),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

function normalizeWorldLabsAssets(value: unknown, fallbackWorldId: string | null): WorldLabsAssetUrls {
  const world = unwrapWorld(value);
  const worldRecord = isRecord(world) ? world : {};
  const assets = isRecord(worldRecord.assets) ? worldRecord.assets : {};
  const splats = isRecord(assets.splats) ? assets.splats : {};
  const mesh = isRecord(assets.mesh) ? assets.mesh : {};
  const canonicalSplatUrls = readSpzUrls(splats.spz_urls);
  const fallbackSplatUrls = canonicalSplatUrls.length > 0 ? canonicalSplatUrls : extractSplatUrls(world);
  const canonicalColliderUrl = stringValue(mesh.collider_mesh_url);
  const fallbackColliderUrls = canonicalColliderUrl ? [canonicalColliderUrl] : extractColliderUrls(world);
  const worldId = readWorldId(world) || fallbackWorldId;

  return {
    colliderUrl: fallbackColliderUrls[0] ?? null,
    splatUrl: fallbackSplatUrls[0] ?? null,
    splatUrls: fallbackSplatUrls,
    worldId,
    worldUrl: stringValue(worldRecord.world_marble_url) || null
  };
}

function unwrapWorld(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return isRecord(value.world) ? value.world : value;
}

function readSpzUrls(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  const preferredKeys = ["500k", "100k", "full_res"];
  const urls = preferredKeys
    .map((key) => stringValue(value[key]))
    .filter(isHttpUrl);
  const remainingUrls = Object.entries(value)
    .filter(([key]) => !preferredKeys.includes(key))
    .map(([, candidate]) => stringValue(candidate))
    .filter(isHttpUrl);

  return [...urls, ...remainingUrls];
}

async function downloadWorldLabsCollider(sceneId: string, version: string, colliderUrl: string) {
  const collider = await downloadRemoteAsset(colliderUrl, "collider");
  const fileName = `pageworld-${sceneId}-${version}-collider.glb`;
  const filePath = path.join(DEMO_SPLAT_DIR, fileName);
  const publicPath = `/splats/demo/${fileName}`;

  await mkdir(DEMO_SPLAT_DIR, { recursive: true });
  await writeFile(filePath, collider.bytes);

  return {
    bytes: collider.bytes.byteLength,
    path: publicPath,
    sourceUrl: colliderUrl
  };
}

async function downloadRemoteAsset(url: string, label: string) {
  if (!isHttpUrl(url)) {
    throw new Error(`${label} URL must be an http(s) URL.`);
  }

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not download ${label} (${response.status}).`);
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer())
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

async function writeCachedSplatManifest(manifest: CachedSplatManifest) {
  await mkdir(DEMO_SPLAT_DIR, { recursive: true });
  await writeFile(DEMO_SPLAT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

function extractSplatUrls(value: unknown): string[] {
  const urls = new Set<string>();
  collectSplatUrls(value, urls);
  return Array.from(urls);
}

function extractColliderUrls(value: unknown): string[] {
  const urls = new Set<string>();
  collectColliderUrls(value, urls);
  return Array.from(urls);
}

function collectColliderUrls(value: unknown, urls: Set<string>) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectColliderUrls(item, urls));
    return;
  }

  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate === "string" && isHttpUrl(candidate) && looksLikeColliderKeyOrUrl(key, candidate)) {
      urls.add(candidate);
    } else if (candidate && typeof candidate === "object") {
      collectColliderUrls(candidate, urls);
    }
  }
}

function collectSplatUrls(value: unknown, urls: Set<string>) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectSplatUrls(item, urls));
    return;
  }

  for (const [key, candidate] of Object.entries(value)) {
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
    || normalizedUrl.endsWith(".spz");
}

function looksLikeColliderKeyOrUrl(key: string, url: string): boolean {
  const normalizedKey = key.toLowerCase();
  const normalizedUrl = url.toLowerCase().split("?")[0];

  return (normalizedKey.includes("collider") || normalizedKey.includes("mesh"))
    && normalizedUrl.endsWith(".glb");
}

function readWorldId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const progress = isRecord(value.progress) ? value.progress : {};

  return stringValue(value.world_id)
    || stringValue(value.id)
    || stringValue(progress.world_id)
    || null;
}

function readOperationError(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value)) {
    return stringValue(value.message) || stringValue(value.detail) || JSON.stringify(value);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
