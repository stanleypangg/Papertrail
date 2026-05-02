"use client";

import { useXR } from "@react-three/xr";
import { useEffect } from "react";

type XRSessionBridgeProps = {
  onSessionChange: (active: boolean) => void;
};

export function XRSessionBridge({ onSessionChange }: XRSessionBridgeProps) {
  const xrActive = useXR((state) => state.mode !== null);

  useEffect(() => {
    onSessionChange(xrActive);
  }, [onSessionChange, xrActive]);

  return null;
}
