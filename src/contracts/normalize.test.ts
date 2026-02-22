import { describe, expect, it } from "vitest";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { applyVisualStateDelta, normalizeVisualState } from "@/contracts/normalize";

describe("normalizeVisualState", () => {
  it("fills missing fields from defaults for backward-compatible playback", () => {
    const state = normalizeVisualState(
      {
        _version: 1,
        _timestamp: 123,
        hue_primary: 40,
        brightness: 0.7,
      },
      999,
    );

    expect(state._version).toBe(1);
    expect(state._timestamp).toBe(123);
    expect(state.hue_primary).toBe(40);
    expect(state.brightness).toBe(0.7);
    expect(state.hue_secondary).toBe(DEFAULT_VISUAL_STATE.hue_secondary);
    expect(state.turbulence).toBe(DEFAULT_VISUAL_STATE.turbulence);
    expect(state.vignette).toBe(DEFAULT_VISUAL_STATE.vignette);
  });

  it("clamps ranges and wraps angle fields", () => {
    const state = normalizeVisualState(
      {
        _version: 1,
        hue_primary: 725,
        hue_secondary: -10,
        brightness: 3,
        saturation: -1,
        mood_pole: 9,
        wave_speed: 5,
        flow_direction: -540,
        particle_density: -0.5,
      },
      1000,
    );

    expect(state.hue_primary).toBe(5);
    expect(state.hue_secondary).toBe(350);
    expect(state.brightness).toBe(1);
    expect(state.saturation).toBe(0);
    expect(state.mood_pole).toBe(1);
    expect(state.wave_speed).toBe(2);
    expect(state.flow_direction).toBe(180);
    expect(state.particle_density).toBe(0);
  });
});

describe("applyVisualStateDelta", () => {
  it("applies set and add semantics and clamps the result", () => {
    const next = applyVisualStateDelta(
      DEFAULT_VISUAL_STATE,
      {
        set: {
          brightness: 0.95,
          hue_primary: 350,
        },
        add: {
          brightness: 0.4,
          hue_primary: 20,
          wave_speed: -1,
          mood_pole: -9,
        },
      },
      2000,
    );

    expect(next._timestamp).toBe(2000);
    expect(next.brightness).toBe(1);
    expect(next.hue_primary).toBe(10);
    expect(next.wave_speed).toBeGreaterThanOrEqual(0);
    expect(next.mood_pole).toBe(-1);
  });
});

