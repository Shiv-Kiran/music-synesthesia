import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { DEFAULT_VISUALIZER_PRESET } from "@/engine/visualizer-presets";
import { useQualiaStore } from "@/state/qualia-store";

describe("useQualiaStore", () => {
  beforeEach(() => {
    useQualiaStore.getState().resetVisualState();
  });

  it("applies deltas to target state with clamping and angle wrapping", () => {
    const { applyDelta } = useQualiaStore.getState();

    applyDelta({
      set: { hue_primary: 355, brightness: 0.9 },
      add: { hue_primary: 20, brightness: 1, mood_pole: -4 },
      lerp_ms: 1500,
      source: "chip",
    });

    const state = useQualiaStore.getState();
    expect(state.targetVisualState.hue_primary).toBe(15);
    expect(state.targetVisualState.brightness).toBe(1);
    expect(state.targetVisualState.mood_pole).toBe(-1);
    expect(state.visualState.hue_primary).toBe(DEFAULT_VISUAL_STATE.hue_primary);
  });

  it("lerps visualState toward targetVisualState via tickLerp", () => {
    const store = useQualiaStore.getState();
    store.resetVisualState();
    store.applyDelta({
      set: {
        brightness: 0.8,
        wave_speed: 1.2,
      },
      lerp_ms: 1000,
      source: "chip",
    });

    const before = useQualiaStore.getState().visualState;
    useQualiaStore.getState().tickLerp(1000);
    useQualiaStore.getState().tickLerp(1033);
    const after = useQualiaStore.getState().visualState;
    const target = useQualiaStore.getState().targetVisualState;

    expect(after.brightness).toBeGreaterThan(before.brightness);
    expect(after.brightness).toBeLessThanOrEqual(target.brightness);
    expect(after.wave_speed).toBeGreaterThan(before.wave_speed);
    expect(after._timestamp).toBe(1033);
  });

  it("setMoodPole writes through deterministic clamp semantics", () => {
    useQualiaStore.getState().setMoodPole(3);
    const { targetVisualState } = useQualiaStore.getState();

    expect(targetVisualState.mood_pole).toBe(1);
  });

  it("stores audio features and gate state snapshots", () => {
    const store = useQualiaStore.getState();

    store.setAudioFeatures({
      rms: 0.04,
      bass_energy: 0.6,
      mid_energy: 0.4,
      high_energy: 0.2,
      spectral_centroid: 0.55,
      zero_crossing_rate: 0.12,
    });
    store.setAudioGateState({
      noise_floor_rms: 0.01,
      energy_threshold_rms: 0.02,
      gated_active: true,
      calibrated_at: 123,
    });

    const state = useQualiaStore.getState();
    expect(state.audioFeatures.bass_energy).toBeCloseTo(0.6);
    expect(state.audioGateState?.gated_active).toBe(true);
    expect(state.audioGateState?.calibrated_at).toBe(123);
  });

  it("switches visualizer presets without resetting visual state", () => {
    const store = useQualiaStore.getState();
    const beforeBrightness = store.targetVisualState.brightness;

    store.setVisualizerPreset("monochrome_concentric_emergence");

    let state = useQualiaStore.getState();
    expect(state.visualizerPreset).toBe("monochrome_concentric_emergence");
    expect(state.targetVisualState.brightness).toBe(beforeBrightness);

    state.setVisualizerPreset(DEFAULT_VISUALIZER_PRESET);
    state = useQualiaStore.getState();
    expect(state.visualizerPreset).toBe(DEFAULT_VISUALIZER_PRESET);
  });
});
