"use client";

import { useEffect, useMemo } from "react";

import type { VisualStateDelta } from "@/contracts/visual-state";
import { SessionCanvas } from "@/ui/SessionCanvas";
import { qualiaSelectors } from "@/state/selectors";
import { useQualiaStore } from "@/state/qualia-store";

const SANDBOX_DELTAS: Record<string, VisualStateDelta> = {
  deep: {
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
  frost: {
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
  ember: {
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
};

type PresetKey = keyof typeof SANDBOX_DELTAS;

export function EngineSandbox() {
  const targetHuePrimary = useQualiaStore(qualiaSelectors.huePrimary);
  const targetHueSecondary = useQualiaStore(qualiaSelectors.hueSecondary);
  const moodPole = useQualiaStore(qualiaSelectors.moodPole);
  const targetVisualState = useQualiaStore(qualiaSelectors.targetVisualState);
  const resetVisualState = useQualiaStore((state) => state.resetVisualState);
  const applyDelta = useQualiaStore((state) => state.applyDelta);
  const setMoodPole = useQualiaStore((state) => state.setMoodPole);

  useEffect(() => {
    resetVisualState();
  }, [resetVisualState]);

  const activePreset = useMemo<PresetKey | "reset">(() => {
    const epsilon = 0.05;
    for (const [key, delta] of Object.entries(SANDBOX_DELTAS) as Array<
      [PresetKey, VisualStateDelta]
    >) {
      const targetMood = delta.set?.mood_pole;
      const targetHue = delta.set?.hue_primary;
      if (
        typeof targetMood === "number" &&
        typeof targetHue === "number" &&
        Math.abs(targetVisualState.mood_pole - targetMood) < 0.08 &&
        Math.abs(targetVisualState.hue_primary - targetHue) < 1 &&
        Math.abs(targetVisualState.depth - (delta.set?.depth ?? targetVisualState.depth)) <
          epsilon
      ) {
        return key;
      }
    }

    return "reset";
  }, [targetVisualState]);

  const applyPreset = (key: PresetKey | "reset") => {
    if (key === "reset") {
      resetVisualState();
      return;
    }

    applyDelta(SANDBOX_DELTAS[key]);
  };

  const handleMoodPoleChange = (value: number) => {
    setMoodPole(value);
  };

  const gradient = `linear-gradient(90deg, hsl(${targetHuePrimary} 75% 52%), hsl(${targetHueSecondary} 75% 58%))`;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#070510] text-white">
      <div className="absolute inset-0">
        <SessionCanvas className="h-full w-full" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(112,94,255,0.08),transparent_55%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.22em] text-white/55 uppercase">
              Qualia
            </p>
            <h1 className="mt-2 max-w-lg text-2xl leading-tight font-semibold text-white sm:text-4xl">
              Store + renderer bridge sandbox
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
              PR-03: Zustand owns the visual state. The canvas reads only the
              current <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-xs">VisualState</code>
              and never touches prompts or audio directly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/session"
              className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs text-white/75 backdrop-blur transition hover:border-white/35 hover:text-white"
            >
              mic flow →
            </a>
            <div className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur">
              target mood: {moodPole.toFixed(2)}
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["reset", "deep", "frost", "ember"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  activePreset === key
                    ? "border-white/60 bg-white/15 text-white"
                    : "border-white/20 bg-black/25 text-white/75 hover:border-white/35 hover:bg-white/10"
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="max-w-xl rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur">
            <div className="mb-2 flex items-center justify-between text-xs text-white/65">
              <span>dissolve</span>
              <span>ignite</span>
            </div>
            <div
              className="relative h-3 w-full rounded-full border border-white/10"
              style={{ backgroundImage: gradient }}
            >
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={moodPole}
                onChange={(event) =>
                  handleMoodPoleChange(Number(event.currentTarget.value))
                }
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
                aria-label="Mood pole"
              />
            </div>
            <div className="mt-2 text-xs text-white/55">
              `setMoodPole` writes directly to the store target state (no debounce).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
