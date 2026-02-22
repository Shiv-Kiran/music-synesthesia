import { describe, expect, it } from "vitest";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { interpolateVisualState, lerpAngleDegrees } from "@/engine/interpolate";

describe("lerpAngleDegrees", () => {
  it("takes the shortest path across the 0/360 seam", () => {
    const midway = lerpAngleDegrees(350, 10, 0.5);
    expect(midway === 0 || midway === 360).toBe(true);
  });
});

describe("interpolateVisualState", () => {
  it("interpolates numeric fields and preserves target metadata", () => {
    const next = interpolateVisualState(
      { ...DEFAULT_VISUAL_STATE, _timestamp: 1, brightness: 0.2, wave_speed: 0.2 },
      { ...DEFAULT_VISUAL_STATE, _timestamp: 2, brightness: 0.8, wave_speed: 1.2 },
      0.5,
    );

    expect(next._timestamp).toBe(2);
    expect(next.brightness).toBeCloseTo(0.5);
    expect(next.wave_speed).toBeCloseTo(0.7);
  });
});

