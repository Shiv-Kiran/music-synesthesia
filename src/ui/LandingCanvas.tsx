"use client";

import { useEffect } from "react";

import { SessionCanvas } from "@/ui/SessionCanvas";
import { useQualiaStore } from "@/state/qualia-store";

export function LandingCanvas() {
  const resetVisualState = useQualiaStore((state) => state.resetVisualState);

  useEffect(() => {
    resetVisualState();
  }, [resetVisualState]);

  return <SessionCanvas className="h-full w-full" />;
}
