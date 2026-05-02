"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, RefreshCcw } from "lucide-react";

import type { WorldRow } from "@/lib/sleuth/db/schema";

export type PlayWorldState =
  | {
      kind: "pending";
      operationId: string;
      startedAt: number;
      degraded: boolean;
    }
  | {
      kind: "done";
      splatUrl: string;
      operationId?: string;
      degraded: boolean;
    }
  | {
      kind: "error";
      message: string;
      operationId?: string;
      degraded: boolean;
    };

interface WorldStatusProps {
  state: Extract<PlayWorldState, { kind: "pending" | "error" }>;
  onStateChange: (state: PlayWorldState) => void;
}

export function buildInitialWorldState(
  row: WorldRow | null | undefined,
): PlayWorldState {
  if (!row) {
    return {
      kind: "error",
      degraded: false,
      message: "World generation has not started yet. Return to the cast page and try again.",
    };
  }

  const degraded = row.operation_id?.startsWith("mock-") ?? false;

  if (row.status === "done" && row.splat_url) {
    return {
      kind: "done",
      operationId: row.operation_id ?? undefined,
      splatUrl: row.splat_url,
      degraded,
    };
  }

  if (row.status === "pending" && row.operation_id) {
    return {
      kind: "pending",
      operationId: row.operation_id,
      degraded,
      startedAt: row.created_at?.getTime() ?? Date.now(),
    };
  }

  return {
    kind: "error",
    operationId: row.operation_id ?? undefined,
    degraded,
    message:
      "The scene could not be prepared from the cached world state. Return to the cast page and try again.",
  };
}

export function estimateWorldProgress(
  startedAt: number,
  now: number = Date.now(),
): number {
  const elapsed = Math.max(0, now - startedAt);
  return Math.min(95, Math.round((elapsed / 120_000) * 100));
}

export async function pollWorldOperation(
  operationId: string,
  startedAt: number,
): Promise<PlayWorldState> {
  const response = await fetch(`/api/sleuth/worlds/${operationId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "Unable to refresh the world status.";
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Ignore malformed error payloads and use the generic fallback above.
    }

    return {
      kind: "error",
      message: detail,
      operationId,
      degraded: false,
    };
  }

  const body = (await response.json()) as {
    done?: boolean;
    splat_url?: string;
    operation_id?: string;
    degraded?: boolean;
    error?: string;
  };

  if (body.done && typeof body.splat_url === "string") {
    return {
      kind: "done",
      operationId: body.operation_id ?? operationId,
      splatUrl: body.splat_url,
      degraded: body.degraded === true,
    };
  }

  if (body.done === false) {
    return {
      kind: "pending",
      operationId: body.operation_id ?? operationId,
      degraded: body.degraded === true,
      startedAt,
    };
  }

  return {
    kind: "error",
    operationId,
    degraded: body.degraded === true,
    message:
      typeof body.error === "string" && body.error.trim()
        ? body.error
        : "The scene returned an unexpected status payload.",
  };
}

export function WorldStatus({ state, onStateChange }: WorldStatusProps) {
  const [retrying, setRetrying] = useState(false);
  const progress =
    state.kind === "pending" ? estimateWorldProgress(state.startedAt) : 0;
  const operationId = state.operationId;
  const stateKind = state.kind;
  const refreshStartedAt = state.kind === "pending" ? state.startedAt : 0;

  const refreshWorld = useCallback(async () => {
    if (!operationId) {
      return;
    }

    setRetrying(true);
    try {
      const nextState = await pollWorldOperation(
        operationId,
        stateKind === "pending" ? refreshStartedAt : Date.now(),
      );
      startTransition(() => {
        onStateChange(nextState);
      });
    } finally {
      setRetrying(false);
    }
  }, [onStateChange, operationId, refreshStartedAt, stateKind]);

  useEffect(() => {
    if (state.kind !== "pending") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void refreshWorld();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshWorld, state.kind]);

  return (
    <section className="relative flex h-full min-h-[20rem] flex-col justify-center overflow-hidden border border-white/10 bg-[#100b0a] px-6 py-10 text-[#f3e7d3] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(168,51,26,0.16),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(214,178,116,0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]" />

      <div className="relative mx-auto flex max-w-xl flex-col gap-5">
        {state.degraded ? (
          <div className="inline-flex w-fit border border-white/12 bg-[#181211] px-3 py-2 text-[0.72rem] uppercase tracking-[0.26em] text-[#c9bbb0]">
            Showing pre-rendered scene (Marble unreachable)
          </div>
        ) : null}

        {state.kind === "pending" ? (
          <>
            <div className="inline-flex items-center gap-3 text-[0.8rem] uppercase tracking-[0.34em] text-[#ba8f6d]">
              <LoaderCircle className="size-4 animate-spin" />
              Marble is building your scene
            </div>
            <h2 className="text-3xl leading-tight text-[#f6ecdb] sm:text-4xl">
              Usually about 2 minutes.
            </h2>
            <p className="max-w-lg text-base leading-7 text-[#d7c8b5]">
              The parlour is being assembled from the script world prompt. The host can
              speak while the scene settles in.
            </p>
            <div className="mt-2 space-y-3">
              <div className="h-2 w-full overflow-hidden bg-white/8">
                <div
                  className="h-full bg-[#a8331a] transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm text-[#baa994]">{progress}% estimated</div>
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-3 text-[0.8rem] uppercase tracking-[0.34em] text-[#cf9b7a]">
              <AlertTriangle className="size-4" />
              World status unavailable
            </div>
            <h2 className="text-3xl leading-tight text-[#f6ecdb] sm:text-4xl">
              The viewer could not refresh.
            </h2>
            <p className="max-w-lg text-base leading-7 text-[#d7c8b5]">
              {state.message}
            </p>
          </>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              void refreshWorld();
            }}
            disabled={!state.operationId || retrying}
            className="inline-flex min-h-11 items-center gap-3 border border-white/14 bg-white/4 px-4 text-sm uppercase tracking-[0.22em] text-[#f3e7d3] transition hover:border-[#a8331a] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCcw className={`size-4 ${retrying ? "animate-spin" : ""}`} />
            Retry status
          </button>
        </div>
      </div>
    </section>
  );
}
