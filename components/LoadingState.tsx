type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#080a0e] px-6 text-stone-50">
      <div className="w-full max-w-md">
        <div className="mb-5 h-1 overflow-hidden bg-white/10">
          <div className="h-full w-2/3 animate-pulse bg-cyan-200" />
        </div>
        <p className="text-sm uppercase tracking-[0.22em] text-cyan-200/80">PageWorld</p>
        <h1 className="mt-3 text-3xl font-semibold">{label}</h1>
        <p className="mt-4 text-sm leading-6 text-stone-400">
          The PDF is being turned into compact scenes, objects, quotes, and transitions.
        </p>
      </div>
    </div>
  );
}

