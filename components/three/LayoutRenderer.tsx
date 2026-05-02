"use client";

import { CorridorPathLayout } from "@/components/three/layouts/CorridorPathLayout";
import { ExhibitSpaceLayout } from "@/components/three/layouts/ExhibitSpaceLayout";
import { InteriorRoomLayout } from "@/components/three/layouts/InteriorRoomLayout";
import { OpenClearingLayout } from "@/components/three/layouts/OpenClearingLayout";
import type { MoodStyle } from "@/lib/sceneMapping";
import type { LayoutType } from "@/lib/sceneSchema";

type LayoutRendererProps = {
  layoutType: LayoutType;
  style: MoodStyle;
  dressing: string;
};

export function LayoutRenderer({ layoutType, style, dressing }: LayoutRendererProps) {
  if (layoutType === "interior_room") {
    return <InteriorRoomLayout style={style} dressing={dressing} />;
  }

  if (layoutType === "open_clearing") {
    return <OpenClearingLayout style={style} dressing={dressing} />;
  }

  if (layoutType === "corridor_path") {
    return <CorridorPathLayout style={style} dressing={dressing} />;
  }

  return <ExhibitSpaceLayout style={style} dressing={dressing} />;
}

