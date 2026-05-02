import { X } from "lucide-react";

import type { SceneObject } from "@/lib/sceneSchema";

type ObjectInfoPanelProps = {
  object: SceneObject | null;
  onClose: () => void;
};

export function ObjectInfoPanel({ object, onClose }: ObjectInfoPanelProps) {
  if (!object) {
    return null;
  }

  return (
    <aside className="fixed right-4 top-24 z-30 w-[min(360px,calc(100vw-2rem))] border border-white/14 bg-[#090d13]/92 p-5 text-stone-50 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/75">Source object</p>
          <h2 className="mt-2 text-2xl font-semibold">{object.label}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close object panel"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-stone-300 transition hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-300">{object.description}</p>
      <blockquote className="mt-5 border-l-2 border-cyan-200 pl-4 text-sm leading-6 text-cyan-50">
        {object.quote}
      </blockquote>
      <p className="mt-4 text-sm leading-6 text-stone-300">{object.explanation}</p>
    </aside>
  );
}

