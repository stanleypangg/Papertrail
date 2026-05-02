type ErrorStateProps = {
  message: string;
  onUseDemo: () => void;
  onReset: () => void;
};

export function ErrorState({ message, onUseDemo, onReset }: ErrorStateProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#090b10] px-6 text-stone-50">
      <div className="w-full max-w-lg border border-white/12 bg-white/[0.03] p-6">
        <p className="text-sm uppercase tracking-[0.22em] text-rose-200">Generation issue</p>
        <h1 className="mt-3 text-3xl font-semibold">The PDF path failed gracefully.</h1>
        <p className="mt-4 text-sm leading-6 text-stone-300">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onUseDemo} className="bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950">
            Use demo world
          </button>
          <button type="button" onClick={onReset} className="border border-white/16 px-4 py-2 text-sm text-stone-100">
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}

