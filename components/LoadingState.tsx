import type { GenerationStage, GenerationStatus } from "@/lib/worldGenerationEvents";

export type LoadingProgressState = {
  percent: number;
  title: string;
  detail: string;
  steps: Array<{
    stage: Exclude<GenerationStage, "initializing" | "complete">;
    label: string;
    status: GenerationStatus;
  }>;
  logs: Array<{
    id: number;
    text: string;
  }>;
  objectProgress: Record<
    string,
    {
      label: string;
      progress: number | null;
      status: string;
    }
  >;
};

type LoadingStateProps = {
  label: string;
  progress?: LoadingProgressState;
};

export function LoadingState({ label, progress }: LoadingStateProps) {
  const percent = Math.round(progress?.percent ?? 66);
  const objectRows = Object.entries(progress?.objectProgress ?? {}).slice(-4).reverse();

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#080a0e] px-5 py-8 text-stone-50 sm:px-6">
      <div className="w-full max-w-3xl">
        <div
          className="mb-5 h-1 overflow-hidden bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress ? percent : undefined}
        >
          <div
            className={`h-full bg-cyan-200 transition-[width] duration-500 ease-out ${progress ? "" : "w-2/3 animate-pulse"}`}
            style={progress ? { width: `${percent}%` } : undefined}
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-200/80">PageWorld</p>
            <h1 className="mt-3 text-3xl font-semibold">{label}</h1>
            <p className="mt-4 text-sm leading-6 text-stone-400">
              {progress?.detail ?? "The PDF is being turned into compact scenes, objects, quotes, and transitions."}
            </p>

            {progress ? (
              <div className="mt-7 border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Current pass</p>
                    <p className="mt-2 text-lg font-semibold text-stone-100">{progress.title}</p>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums text-cyan-100">{percent}%</p>
                </div>

                {objectRows.length > 0 ? (
                  <div className="mt-5 grid gap-2">
                    {objectRows.map(([key, object]) => (
                      <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                        <p className="min-w-0 truncate text-stone-300">{object.label}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                          {object.progress === null ? humanizeStatus(object.status) : `${Math.round(object.progress)}%`}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {progress ? (
            <aside className="grid gap-5">
              <div className="border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Build steps</p>
                <ol className="mt-4 grid gap-3">
                  {progress.steps.map((step) => (
                    <li key={step.stage} className="flex items-center gap-3 text-sm">
                      <span className={`h-2.5 w-2.5 shrink-0 ${statusDotClass(step.status)}`} />
                      <span className="min-w-0 flex-1 truncate text-stone-200">{step.label}</span>
                      <span className={`text-xs uppercase tracking-[0.14em] ${statusTextClass(step.status)}`}>
                        {step.status}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Live log</p>
                <div className="mt-4 grid min-h-28 content-start gap-2 text-sm leading-5 text-stone-400">
                  {progress.logs.length > 0 ? (
                    progress.logs.map((entry) => <p key={entry.id}>{entry.text}</p>)
                  ) : (
                    <p>Waiting for the first stream event.</p>
                  )}
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function statusDotClass(status: GenerationStatus): string {
  if (status === "complete") {
    return "bg-cyan-200";
  }

  if (status === "active") {
    return "animate-pulse bg-white";
  }

  if (status === "warning") {
    return "bg-amber-200";
  }

  if (status === "error") {
    return "bg-red-300";
  }

  return "bg-white/20";
}

function statusTextClass(status: GenerationStatus): string {
  if (status === "complete") {
    return "text-cyan-100/80";
  }

  if (status === "active") {
    return "text-stone-100";
  }

  if (status === "warning") {
    return "text-amber-100";
  }

  if (status === "error") {
    return "text-red-200";
  }

  return "text-stone-600";
}

function humanizeStatus(status: string): string {
  return status ? status.toLowerCase().replaceAll("_", " ") : "working";
}
