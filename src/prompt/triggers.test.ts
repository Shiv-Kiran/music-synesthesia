import { describe, expect, it } from "vitest";

import { detectPromptAudioEvent } from "@/prompt/triggers";

describe("detectPromptAudioEvent", () => {
  it("returns null when the gate is inactive", () => {
    const event = detectPromptAudioEvent({
      current: {
        rms: 0.1,
        bass_energy: 0.8,
        mid_energy: 0.4,
        high_energy: 0.2,
        spectral_centroid: 0.4,
        zero_crossing_rate: 0.1,
      },
      previous: {
        rms: 0.01,
        bass_energy: 0.1,
        mid_energy: 0.1,
        high_energy: 0.1,
        spectral_centroid: 0.2,
        zero_crossing_rate: 0.05,
      },
      gate: {
        noise_floor_rms: 0.01,
        energy_threshold_rms: 0.02,
        gated_active: false,
      },
    });

    expect(event).toBeNull();
  });

  it("detects an energy spike from RMS + bass jump", () => {
    const event = detectPromptAudioEvent({
      current: {
        rms: 0.08,
        bass_energy: 0.5,
        mid_energy: 0.3,
        high_energy: 0.2,
        spectral_centroid: 0.35,
        zero_crossing_rate: 0.08,
      },
      previous: {
        rms: 0.02,
        bass_energy: 0.1,
        mid_energy: 0.15,
        high_energy: 0.12,
        spectral_centroid: 0.25,
        zero_crossing_rate: 0.05,
      },
      gate: {
        noise_floor_rms: 0.01,
        energy_threshold_rms: 0.02,
        gated_active: true,
      },
    });

    expect(event).toBe("energy_spike");
  });

  it("detects a drop after a stronger frame falls below threshold band", () => {
    const event = detectPromptAudioEvent({
      current: {
        rms: 0.006,
        bass_energy: 0.05,
        mid_energy: 0.04,
        high_energy: 0.03,
        spectral_centroid: 0.2,
        zero_crossing_rate: 0.04,
      },
      previous: {
        rms: 0.05,
        bass_energy: 0.4,
        mid_energy: 0.35,
        high_energy: 0.2,
        spectral_centroid: 0.4,
        zero_crossing_rate: 0.08,
      },
      gate: {
        noise_floor_rms: 0.01,
        energy_threshold_rms: 0.02,
        gated_active: true,
      },
    });

    expect(event).toBe("drop");
  });
});

