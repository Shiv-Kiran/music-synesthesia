"use client";

import { useEffect, useRef } from "react";

import { createQualiaEngine } from "@/engine/createQualiaEngine";
import { qualiaSelectors } from "@/state/selectors";
import { useQualiaStore } from "@/state/qualia-store";

export interface SessionCanvasProps {
  className?: string;
}

export function SessionCanvas({ className }: SessionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const engine = createQualiaEngine(canvas, { transitionSmoothing: false });
    engine.applyVisualState(useQualiaStore.getState().visualState);

    const unsubscribe = useQualiaStore.subscribe(
      qualiaSelectors.visualState,
      (visualState) => {
        engine.applyVisualState(visualState);
      },
    );

    let rafId = 0;
    const tick = (timeMs: number) => {
      useQualiaStore.getState().tickLerp(timeMs);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      engine.resize(entry.contentRect.width, entry.contentRect.height);
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    } else {
      engine.resize();
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      unsubscribe();
      engine.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}

