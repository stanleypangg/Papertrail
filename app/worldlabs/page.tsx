"use client";

import { Check, Download, Loader2, Play, RefreshCcw, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type WorldLabsScene = {
  id: string;
  title: string;
  prompt: string;
  cachedPath: string | null;
  colliderPath: string | null;
  latestVersion: string | null;
  versions: CachedSplatVersion[];
  worldId: string | null;
};

type OperationState = {
  cachedPath?: string | null;
  colliderPath?: string | null;
  cacheNote?: string;
  error?: string;
  colliderUrls?: string[];
  operationId?: string;
  polling?: boolean;
  raw?: unknown;
  splatUrls?: string[];
  status: "idle" | "starting" | "running" | "done" | "cached" | "error";
  version?: string;
  worldId?: string | null;
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

type WorldLabsAssets = {
  colliderUrl: string | null;
  splatUrl: string | null;
  splatUrls: string[];
  worldId: string | null;
  worldUrl: string | null;
};

type OperationResponse = {
  assets: WorldLabsAssets;
  done: boolean;
  error: string | null;
  metadata: unknown;
  operationId: string;
  raw: unknown;
  colliderUrls: string[];
  splatUrls: string[];
  worldId: string | null;
};

const POLL_INTERVAL_MS = 8000;

export default function WorldLabsPage() {
  const [scenes, setScenes] = useState<WorldLabsScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [operations, setOperations] = useState<Record<string, OperationState>>({});
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const pollTimers = useRef<Record<string, number>>({});

  const allBusy = useMemo(
    () => scenes.some((scene) => ["starting", "running"].includes(operations[scene.id]?.status ?? "")),
    [operations, scenes]
  );

  useEffect(() => {
    void loadScenes();
    const timers = pollTimers.current;

    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  async function loadScenes() {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/worldlabs/scenes", { cache: "no-store" });
      const body = (await response.json()) as { scenes?: WorldLabsScene[]; error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load demo scenes.");
      }

      const nextScenes = body.scenes ?? [];
      setScenes(nextScenes);
      setPrompts((current) => ({
        ...Object.fromEntries(nextScenes.map((scene) => [scene.id, current[scene.id] ?? scene.prompt])),
        ...current
      }));
      setOperations((current) => Object.fromEntries(nextScenes.map((scene) => {
        const existing = current[scene.id];
        const cachedPath = existing?.cachedPath ?? scene.cachedPath;
        const colliderPath = existing?.colliderPath ?? scene.colliderPath;
        const worldId = existing?.worldId ?? scene.worldId;

        return [
          scene.id,
          {
            ...existing,
            cachedPath,
            colliderPath,
            version: existing?.version ?? scene.latestVersion ?? undefined,
            worldId,
            status: existing?.status && existing.status !== "idle"
              ? existing.status
              : cachedPath ? "cached" : "idle"
          } satisfies OperationState
        ];
      })));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load demo scenes.");
    } finally {
      setLoading(false);
    }
  }

  async function generateScene(sceneId: string) {
    clearPoll(sceneId);
      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          cacheNote: undefined,
          colliderUrls: [],
          error: undefined,
          operationId: undefined,
        polling: false,
        raw: undefined,
        splatUrls: [],
        status: "starting"
      }
    }));

    try {
      const response = await fetch("/api/worldlabs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, prompt: prompts[sceneId] })
      });
      const body = (await response.json()) as { operationId?: string; raw?: unknown; error?: string };

      if (!response.ok || !body.operationId) {
        throw new Error(body.error ?? "World Labs did not return an operation id.");
      }

      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          operationId: body.operationId,
          colliderUrls: [],
          raw: body.raw,
          splatUrls: [],
          status: "running"
        }
      }));
      pollScene(sceneId, body.operationId);
    } catch (error) {
      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          error: error instanceof Error ? error.message : "Could not start World Labs generation.",
          status: "error"
        }
      }));
    }
  }

  async function pollScene(sceneId: string, operationId: string) {
    clearPoll(sceneId);
    setOperations((current) => ({
      ...current,
      [sceneId]: {
        ...current[sceneId],
        polling: true,
        status: "running"
      }
    }));

    try {
      const response = await fetch(`/api/worldlabs/operations/${encodeURIComponent(operationId)}`, { cache: "no-store" });
      const body = (await response.json()) as OperationResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not poll World Labs generation.");
      }

      const providerError = body.error;
      if (providerError) {
        throw new Error(providerError);
      }

      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          operationId,
          colliderUrls: body.colliderUrls,
          polling: false,
          raw: body.raw,
          splatUrls: body.splatUrls,
          status: body.done ? "done" : "running",
          worldId: body.worldId
        }
      }));

      if (body.done && (body.assets.splatUrl || body.splatUrls[0] || body.worldId)) {
        await cacheSplat(sceneId, body.assets.splatUrl ?? body.splatUrls[0], operationId, {
          automatic: true,
          colliderUrl: body.assets.colliderUrl ?? body.colliderUrls[0],
          worldId: body.worldId ?? undefined
        });
      }

      if (!body.done) {
        pollTimers.current[sceneId] = window.setTimeout(() => pollScene(sceneId, operationId), POLL_INTERVAL_MS);
      }
    } catch (error) {
      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          error: error instanceof Error ? error.message : "Could not poll World Labs generation.",
          polling: false,
          status: "error"
        }
      }));
    }
  }

  async function cacheSplat(
    sceneId: string,
    splatUrl?: string | null,
    operationId = operations[sceneId]?.operationId,
    options: { automatic?: boolean; colliderUrl?: string | null; worldId?: string } = {}
  ) {
    const prompt = prompts[sceneId];

    setOperations((current) => ({
      ...current,
      [sceneId]: {
        ...current[sceneId],
        cacheNote: options.automatic ? "Auto-saving splat to public folder." : undefined,
        error: undefined,
        status: "running"
      }
    }));

    try {
      const response = await fetch("/api/worldlabs/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colliderUrl: options.colliderUrl ?? operations[sceneId]?.colliderUrls?.[0],
          operationId,
          prompt,
          sceneId,
          splatUrl,
          worldId: options.worldId ?? operations[sceneId]?.worldId ?? undefined
        })
      });
      const body = (await response.json()) as { colliderPath?: string | null; path?: string; version?: string; bytes?: number; error?: string; worldId?: string | null };

      if (!response.ok || !body.path) {
        throw new Error(body.error ?? "Could not cache splat.");
      }

      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          cacheNote: options.automatic ? "Saved automatically to public/splats/demo." : "Saved to public/splats/demo.",
          cachedPath: body.path,
          colliderPath: body.colliderPath ?? current[sceneId]?.colliderPath,
          status: "cached",
          version: body.version,
          worldId: body.worldId ?? current[sceneId]?.worldId
        }
      }));
      await loadScenes();
    } catch (error) {
      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          error: error instanceof Error ? error.message : "Could not cache splat.",
          status: "error"
        }
      }));
    }
  }

  async function cacheCollider(sceneId: string) {
    const operationId = operations[sceneId]?.operationId
      ?? scenes.find((scene) => scene.id === sceneId)?.versions.find((version) => version.operationId)?.operationId;
    const worldId = operations[sceneId]?.worldId
      ?? scenes.find((scene) => scene.id === sceneId)?.worldId
      ?? scenes.find((scene) => scene.id === sceneId)?.versions.find((version) => version.worldId)?.worldId;
    const colliderUrl = operations[sceneId]?.colliderUrls?.[0];

    setOperations((current) => ({
      ...current,
      [sceneId]: {
        ...current[sceneId],
        cacheNote: "Fetching collider mesh from World Labs.",
        error: undefined,
        status: "running"
      }
    }));

    try {
      const response = await fetch("/api/worldlabs/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colliderOnly: true, colliderUrl, operationId, sceneId, worldId })
      });
      const body = (await response.json()) as { path?: string; bytes?: number; error?: string };

      if (!response.ok || !body.path) {
        throw new Error(body.error ?? "Could not cache collider mesh.");
      }

      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          cacheNote: "Saved collider mesh to public/splats/demo.",
          colliderPath: body.path,
          status: "cached"
        }
      }));
      await loadScenes();
    } catch (error) {
      setOperations((current) => ({
        ...current,
        [sceneId]: {
          ...current[sceneId],
          error: error instanceof Error ? error.message : "Could not cache collider mesh.",
          status: "error"
        }
      }));
    }
  }

  async function generateAll() {
    for (const scene of scenes) {
      await generateScene(scene.id);
    }
  }

  function updatePrompt(sceneId: string, prompt: string) {
    setPrompts((current) => ({ ...current, [sceneId]: prompt }));
  }

  function resetPrompt(scene: WorldLabsScene) {
    updatePrompt(scene.id, scene.prompt);
  }

  function clearPoll(sceneId: string) {
    const timer = pollTimers.current[sceneId];

    if (timer) {
      window.clearTimeout(timer);
      delete pollTimers.current[sceneId];
    }
  }

  return (
    <main className="min-h-svh bg-[#080a0f] px-5 py-6 text-stone-50 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">World Labs cache builder</p>
            <h1 className="mt-2 text-3xl font-semibold">Harry Potter demo worlds</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
              Generate the hardcoded demo scenes with World Labs, then cache each returned splat under public/splats/demo for a faster demo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadScenes}
              className="inline-flex min-h-10 items-center gap-2 border border-white/14 px-4 text-sm text-stone-200 transition hover:border-cyan-200/60"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button
              type="button"
              onClick={generateAll}
              disabled={allBusy || scenes.length === 0}
              className="inline-flex min-h-10 items-center gap-2 bg-cyan-200 px-4 text-sm font-semibold text-slate-950 transition disabled:cursor-wait disabled:opacity-60"
            >
              <Play size={16} />
              Generate all
            </button>
          </div>
        </header>

        {loadError ? (
          <div className="mt-4 border border-amber-200/20 bg-amber-200/8 p-3 text-sm leading-6 text-amber-100">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 flex min-h-48 items-center justify-center border border-white/12 bg-white/[0.035] text-stone-300">
            <Loader2 size={18} className="mr-2 animate-spin" />
            Loading scenes
          </div>
        ) : (
          <div className="grid gap-4 py-6 lg:grid-cols-2">
            {scenes.map((scene, index) => {
              const state = operations[scene.id] ?? { status: "idle" };
              const prompt = prompts[scene.id] ?? scene.prompt;
              const colliderUrl = state.colliderUrls?.[0];
              const splatUrl = state.splatUrls?.[0];
              const busy = state.status === "starting" || state.status === "running";

              return (
                <article key={scene.id} className="border border-white/12 bg-white/[0.035] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Scene {index + 1}</p>
                      <h2 className="mt-2 text-2xl font-semibold">{scene.title}</h2>
                    </div>
                    <StatusBadge status={state.status} />
                  </div>

                  <label className="mt-5 block">
                    <span className="text-xs uppercase tracking-[0.18em] text-stone-500">World Labs prompt</span>
                    <textarea
                      value={prompt}
                      onChange={(event) => updatePrompt(scene.id, event.target.value)}
                      spellCheck={false}
                      className="mt-2 min-h-64 w-full resize-y border border-white/14 bg-black/35 p-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-cyan-200/70"
                    />
                  </label>

                  <dl className="mt-5 grid gap-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Operation</dt>
                      <dd className="mt-1 break-all text-stone-300">{state.operationId ?? "Not started"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">World ID</dt>
                      <dd className="mt-1 break-all text-stone-300">{state.worldId ?? scene.worldId ?? "Unknown"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Cached splat</dt>
                      <dd className="mt-1 break-all text-stone-300">{state.cachedPath ?? scene.cachedPath ?? "Not cached"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Cached collider</dt>
                      <dd className="mt-1 break-all text-stone-300">{state.colliderPath ?? scene.colliderPath ?? "Not cached"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Latest version</dt>
                      <dd className="mt-1 break-all text-stone-300">{state.version ?? scene.latestVersion ?? "No cached version"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Returned splat URL</dt>
                      <dd className="mt-1 break-all text-stone-300">{splatUrl ?? "Waiting for completed operation"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-stone-500">Returned collider URL</dt>
                      <dd className="mt-1 break-all text-stone-300">{colliderUrl ?? "Waiting for completed operation"}</dd>
                    </div>
                  </dl>

                  {state.cacheNote ? (
                    <div className="mt-4 border border-emerald-200/20 bg-emerald-200/8 p-3 text-sm leading-6 text-emerald-100">
                      {state.cacheNote}
                    </div>
                  ) : null}

                  {state.error ? (
                    <div className="mt-4 border border-amber-200/20 bg-amber-200/8 p-3 text-sm leading-6 text-amber-100">
                      {state.error}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => generateScene(scene.id)}
                      disabled={busy || prompt.trim().length === 0}
                      className="inline-flex min-h-10 items-center gap-2 bg-cyan-200 px-4 text-sm font-semibold text-slate-950 transition disabled:cursor-wait disabled:opacity-60"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                      {busy ? "Working" : "Generate"}
                    </button>

                    <button
                      type="button"
                      onClick={() => resetPrompt(scene)}
                      disabled={busy}
                      className="inline-flex min-h-10 items-center gap-2 border border-white/14 px-4 text-sm text-stone-200 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Reset prompt
                    </button>

                    <button
                      type="button"
                      onClick={() => state.operationId && pollScene(scene.id, state.operationId)}
                      disabled={!state.operationId || busy}
                      className="inline-flex min-h-10 items-center gap-2 border border-white/14 px-4 text-sm text-stone-200 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <RefreshCcw size={16} />
                      Poll
                    </button>

                    <button
                      type="button"
                      onClick={() => cacheSplat(scene.id, splatUrl)}
                      disabled={busy || (!splatUrl && !state.operationId && !(state.worldId ?? scene.worldId))}
                      className="inline-flex min-h-10 items-center gap-2 border border-white/14 px-4 text-sm text-stone-200 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Save size={16} />
                      Cache
                    </button>

                    <button
                      type="button"
                      onClick={() => cacheCollider(scene.id)}
                      disabled={busy || (!(state.operationId ?? scene.versions.find((version) => version.operationId)?.operationId) && !(state.worldId ?? scene.worldId) && !colliderUrl) || !(state.cachedPath ?? scene.cachedPath)}
                      className="inline-flex min-h-10 items-center gap-2 border border-white/14 px-4 text-sm text-stone-200 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Save size={16} />
                      Cache collider
                    </button>

                    {(state.cachedPath ?? scene.cachedPath) ? (
                      <a
                        href={state.cachedPath ?? scene.cachedPath ?? ""}
                        download
                        className="inline-flex min-h-10 items-center gap-2 border border-white/14 px-4 text-sm text-stone-200 transition hover:border-cyan-200/60"
                      >
                        <Download size={16} />
                        Download cached
                      </a>
                    ) : null}
                  </div>

                  {splatUrl ? (
                    <a
                      href={splatUrl}
                      download
                      className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-cyan-100 hover:text-cyan-50"
                    >
                      <Download size={16} />
                      Download returned splat
                    </a>
                  ) : null}

                  {scene.versions.length > 0 ? (
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Saved versions</p>
                      <div className="mt-3 grid gap-2">
                        {scene.versions.slice(0, 5).map((version) => (
                          <div key={version.version} className="flex flex-col gap-2 border border-white/10 bg-black/20 p-3 text-xs text-stone-300 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-semibold text-stone-100">{version.version}</p>
                              <p className="mt-1 break-all text-stone-400">{version.path}</p>
                              {version.colliderPath ? <p className="mt-1 break-all text-emerald-200/80">Collider: {version.colliderPath}</p> : null}
                            </div>
                            <a
                              href={version.path}
                              download
                              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 border border-white/14 px-3 text-stone-200 transition hover:border-cyan-200/60"
                            >
                              <Download size={14} />
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: OperationState["status"] }) {
  const label = {
    cached: "Cached",
    done: "Done",
    error: "Error",
    idle: "Idle",
    running: "Running",
    starting: "Starting"
  }[status];

  const className = status === "cached"
    ? "border-emerald-200/30 bg-emerald-200/10 text-emerald-100"
    : status === "done"
      ? "border-cyan-200/30 bg-cyan-200/10 text-cyan-100"
      : status === "error"
        ? "border-amber-200/30 bg-amber-200/10 text-amber-100"
        : "border-white/14 bg-black/25 text-stone-300";

  return (
    <span className={`inline-flex min-h-8 items-center gap-2 border px-3 text-xs font-semibold uppercase tracking-[0.14em] ${className}`}>
      {status === "cached" ? <Check size={14} /> : null}
      {label}
    </span>
  );
}
