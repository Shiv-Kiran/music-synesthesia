import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
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
});

