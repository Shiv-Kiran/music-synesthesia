import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { EMPTY_AUDIO_FEATURES } from "@/audio/features";
import type { AudioFeatures, AudioGateState } from "@/contracts/audio";
import { DEFAULT_VISUAL_STATE, DEFAULT_VISUAL_LERP_MS } from "@/contracts/defaults";
import { applyVisualStateDelta, normalizeVisualState } from "@/contracts/normalize";
import type { VisualState, VisualStateDelta } from "@/contracts/visual-state";
import {
  expSmoothingFactor,
  interpolateVisualState,
} from "@/engine/interpolate";
import {
  DEFAULT_VISUALIZER_PRESET,
  type VisualizerPresetId,
} from "@/engine/visualizer-presets";

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

export interface QualiaStoreState {
  visualState: VisualState;
  targetVisualState: VisualState;
  visualizerPreset: VisualizerPresetId;
  audioFeatures: AudioFeatures;
  audioGateState: AudioGateState | null;
  lastTickMs: number | null;
  lastLerpMs: number;
  resetVisualState: () => void;
  setVisualState: (state: Partial<VisualState>) => void;
  setTargetVisualState: (state: Partial<VisualState>) => void;
  setAudioFeatures: (features: AudioFeatures) => void;
  setAudioGateState: (gateState: AudioGateState | null) => void;
  setVisualizerPreset: (preset: VisualizerPresetId) => void;
  applyDelta: (delta: VisualStateDelta) => void;
  setMoodPole: (value: number) => void;
  tickLerp: (timeMs?: number) => void;
}

function createInitialVisualState() {
  return normalizeVisualState(DEFAULT_VISUAL_STATE, nowMs());
}

const initialState = createInitialVisualState();

export const useQualiaStore = create<QualiaStoreState>()(
  subscribeWithSelector((set, get) => ({
    visualState: initialState,
    targetVisualState: initialState,
    visualizerPreset: DEFAULT_VISUALIZER_PRESET,
    audioFeatures: { ...EMPTY_AUDIO_FEATURES },
    audioGateState: null,
    lastTickMs: null,
    lastLerpMs: DEFAULT_VISUAL_LERP_MS,

    resetVisualState: () => {
      const timestamp = nowMs();
      const resetState = normalizeVisualState(DEFAULT_VISUAL_STATE, timestamp);
      set({
        visualState: resetState,
        targetVisualState: resetState,
        audioFeatures: { ...EMPTY_AUDIO_FEATURES },
        audioGateState: null,
        lastTickMs: timestamp,
        lastLerpMs: DEFAULT_VISUAL_LERP_MS,
      });
    },

    setVisualState: (state) => {
      const timestamp = nowMs();
      const next = normalizeVisualState(state, timestamp);
      set({
        visualState: next,
        targetVisualState: next,
        lastTickMs: timestamp,
      });
    },

    setTargetVisualState: (state) => {
      const timestamp = nowMs();
      const nextTarget = normalizeVisualState(
        {
          ...get().targetVisualState,
          ...state,
        },
        timestamp,
      );
      set({
        targetVisualState: nextTarget,
      });
    },

    setAudioFeatures: (features) => {
      set({
        audioFeatures: {
          rms: features.rms,
          bass_energy: features.bass_energy,
          mid_energy: features.mid_energy,
          high_energy: features.high_energy,
          spectral_centroid: features.spectral_centroid,
          zero_crossing_rate: features.zero_crossing_rate,
          ...(typeof features.bpm_estimate === "number"
            ? { bpm_estimate: features.bpm_estimate }
            : {}),
        },
      });
    },

    setAudioGateState: (gateState) => {
      set({
        audioGateState: gateState ? { ...gateState } : null,
      });
    },

    setVisualizerPreset: (preset) => {
      set({ visualizerPreset: preset });
    },

    applyDelta: (delta) => {
      const timestamp = nowMs();
      const baseTarget = get().targetVisualState;
      const nextTarget = applyVisualStateDelta(baseTarget, delta, timestamp);
      set({
        targetVisualState: nextTarget,
        lastLerpMs:
          typeof delta.lerp_ms === "number" && Number.isFinite(delta.lerp_ms)
            ? Math.max(0, delta.lerp_ms)
            : DEFAULT_VISUAL_LERP_MS,
      });
    },

    setMoodPole: (value) => {
      get().applyDelta({
        set: { mood_pole: value },
        lerp_ms: 0,
        source: "mood_bar",
      });
    },

    tickLerp: (timeMs = nowMs()) => {
      const state = get();
      const lastTickMs = state.lastTickMs ?? timeMs;
      const dtSeconds = Math.min(Math.max((timeMs - lastTickMs) / 1000, 0), 0.1);

      if (dtSeconds === 0) {
        set({ lastTickMs: timeMs });
        return;
      }

      const durationMs = Math.max(state.lastLerpMs, 0);
      const speed = durationMs === 0 ? 60 : Math.max(3, 900 / durationMs);
      const alpha = durationMs === 0 ? 1 : expSmoothingFactor(dtSeconds, speed);

      const nextVisualState = interpolateVisualState(
        state.visualState,
        state.targetVisualState,
        alpha,
      );
      nextVisualState._timestamp = timeMs;

      set({
        visualState: nextVisualState,
        lastTickMs: timeMs,
      });
    },
  })),
);
