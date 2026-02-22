import { describe, expect, it } from "vitest";

import { createSyntheticAudioSource } from "@/audio/dev-synthetic";

describe("createSyntheticAudioSource", () => {
  it("produces deterministic calibration RMS values", () => {
    const sourceA = createSyntheticAudioSource();
    const sourceB = createSyntheticAudioSource();

    const samplesA = [0, 250, 800, 1400, 2200, 2900].map((ms) =>
      sourceA.sampleCalibrationRms(ms),
    );
    const samplesB = [0, 250, 800, 1400, 2200, 2900].map((ms) =>
      sourceB.sampleCalibrationRms(ms),
    );

    expect(samplesA).toEqual(samplesB);
    for (const rms of samplesA) {
      expect(rms).toBeGreaterThan(0);
      expect(rms).toBeLessThan(0.01);
    }
  });

  it("produces bounded audio features across the loop", () => {
    const source = createSyntheticAudioSource();

    for (let ms = 0; ms <= 30_000; ms += 317) {
      const frame = source.sampleFeatures(ms);
      expect(frame.rms).toBeGreaterThanOrEqual(0);
      expect(frame.rms).toBeLessThanOrEqual(0.25);
      expect(frame.bass_energy).toBeGreaterThanOrEqual(0);
      expect(frame.bass_energy).toBeLessThanOrEqual(1);
      expect(frame.mid_energy).toBeGreaterThanOrEqual(0);
      expect(frame.mid_energy).toBeLessThanOrEqual(1);
      expect(frame.high_energy).toBeGreaterThanOrEqual(0);
      expect(frame.high_energy).toBeLessThanOrEqual(1);
      expect(frame.spectral_centroid).toBeGreaterThanOrEqual(0);
      expect(frame.spectral_centroid).toBeLessThanOrEqual(1);
      expect(frame.zero_crossing_rate).toBeGreaterThanOrEqual(0);
      expect(frame.zero_crossing_rate).toBeLessThanOrEqual(1);
    }
  });

  it("contains a clear quiet drop and louder spike phases for prompt testing", () => {
    const source = createSyntheticAudioSource();

    const quietRms = source.sampleFeatures(14_500).rms;
    const loudRms = source.sampleFeatures(11_000).rms;
    const accentRms = source.sampleFeatures(21_000).rms;

    expect(loudRms).toBeGreaterThan(quietRms * 2.5);
    expect(accentRms).toBeGreaterThan(quietRms * 2);
  });
});

