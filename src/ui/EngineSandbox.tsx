"use client";

import { useEffect, useRef, useState } from "react";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { applyVisualStateDelta } from "@/contracts/normalize";
import { createQualiaEngine } from "@/engine/createQualiaEngine";

const previewStates = {
  reset: DEFAULT_VISUAL_STATE,
  deep: applyVisualStateDelta(
    DEFAULT_VISUAL_STATE,
    {
      set: {
        depth: 0.85,
        scale: 0.62,
        vignette: 0.42,
        turbulence: 0.18,
        flow_direction: 260,
      },
      add: { brightness: -0.06, hue_chaos: 0.08 },
      source: "chip",
      lerp_ms: 1800,
    },
    1,
  ),
  frost: applyVisualStateDelta(
    DEFAULT_VISUAL_STATE,
    {
      set: {
        hue_primary: 215,
        hue_secondary: 252,
        brightness: 0.21,
        saturation: 0.54,
        mood_pole: -0.35,
      },
      add: { blur: 0.14, wave_speed: -0.08 },
      source: "chip",
      lerp_ms: 1600,
    },
    1,
  ),
  ember: applyVisualStateDelta(
    DEFAULT_VISUAL_STATE,
    {
      set: {
        hue_primary: 10,
        hue_secondary: 36,
        brightness: 0.56,
        saturation: 0.8,
        mood_pole: 0.48,
      },
      add: { turbulence: 0.2, pulse_strength: 0.2, wave_speed: 0.35 },
      source: "chip",
      lerp_ms: 1500,
    },
    1,
  ),
} as const;

type PreviewKey = keyof typeof previewStates;

export function EngineSandbox() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ReturnType<typeof createQualiaEngine> | null>(null);
  const [active, setActive] = useState<PreviewKey>("reset");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const engine = createQualiaEngine(canvas);
    engineRef.current = engine;
    engine.applyVisualState(previewStates.reset);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      engine.resize(width, height);
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const cycle: PreviewKey[] = ["reset", "deep", "frost", "ember"];
    let idx = 0;
    const interval = window.setInterval(() => {
      idx = (idx + 1) % cycle.length;
      const key = cycle[idx];
      setActive(key);
      engine.applyVisualState(previewStates[key]);
    }, 9000);

    return () => {
      window.clearInterval(interval);
      resizeObserver.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleApply = (key: PreviewKey) => {
    setActive(key);
    engineRef.current?.applyVisualState(previewStates[key]);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#070510] text-white">
      <div className="absolute inset-0">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(112,94,255,0.08),transparent_55%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.22em] text-white/55 uppercase">
              Qualia
            </p>
            <h1 className="mt-2 max-w-lg text-2xl leading-tight font-semibold text-white sm:text-4xl">
              Visual engine sandbox
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">
              PR-02: plain Three.js engine with a single public API:
              <code className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white">
                applyVisualState(state)
              </code>
            </p>
          </div>
          <div className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur">
            active: {active}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {(
            Object.keys(previewStates) as PreviewKey[]
          ).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleApply(key)}
              className={`pointer-events-auto rounded-full border px-3 py-1.5 text-sm transition ${
                active === key
                  ? "border-white/60 bg-white/15 text-white"
                  : "border-white/20 bg-black/25 text-white/75 hover:border-white/35 hover:bg-white/10"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

