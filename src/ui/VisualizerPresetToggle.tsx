"use client";

import {
  VISUALIZER_PRESETS,
  type VisualizerPresetId,
} from "@/engine/visualizer-presets";
import { useQualiaStore } from "@/state/qualia-store";

export interface VisualizerPresetToggleProps {
  className?: string;
}

export function VisualizerPresetToggle({ className }: VisualizerPresetToggleProps) {
  const visualizerPreset = useQualiaStore((state) => state.visualizerPreset);
  const setVisualizerPreset = useQualiaStore((state) => state.setVisualizerPreset);

  return (
    <div
      className={
        className ??
        "pointer-events-auto rounded-2xl border border-white/10 bg-black/35 p-2 backdrop-blur"
      }
    >
      <div className="mb-2 px-1 text-[10px] tracking-[0.18em] text-white/45 uppercase">
        visual preset
      </div>
      <div className="flex flex-wrap gap-1">
        {VISUALIZER_PRESETS.map((preset) => {
          const active = preset.id === visualizerPreset;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setVisualizerPreset(preset.id as VisualizerPresetId)}
              className="rounded-full border px-3 py-1 text-[11px] transition"
              style={{
                borderColor: active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)",
                background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.72)",
              }}
              title={preset.description}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
