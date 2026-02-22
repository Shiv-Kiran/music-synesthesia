import { describe, expect, it } from "vitest";

import {
  computeBandEnergiesNormalized,
  computeSpectralCentroidNormalized,
  computeZeroCrossingRate,
  createAudioFeatureBuffers,
  extractAudioFeaturesFromFrame,
} from "@/audio/features";

describe("audio feature helpers", () => {
  it("allocates time and frequency buffers from fftSize", () => {
    const buffers = createAudioFeatureBuffers(2048);
    expect(buffers.timeDomain.length).toBe(2048);
    expect(buffers.frequency.length).toBe(1024);
  });

  it("computes zero crossing rate for alternating waveform", () => {
    const zcr = computeZeroCrossingRate([1, -1, 1, -1, 1]);
    expect(zcr).toBeCloseTo(1);
  });

  it("computes normalized spectral centroid from FFT magnitudes", () => {
    const lowHeavy = computeSpectralCentroidNormalized([255, 64, 0, 0]);
    const highHeavy = computeSpectralCentroidNormalized([0, 0, 64, 255]);
    expect(lowHeavy).toBeLessThan(highHeavy);
    expect(lowHeavy).toBeGreaterThanOrEqual(0);
    expect(highHeavy).toBeLessThanOrEqual(1);
  });

  it("splits FFT bins into bass/mid/high normalized energies", () => {
    const fftSize = 16;
    const sampleRate = 16000;
    // Bin frequencies approx: 0, 1000, 2000, ... because nyquist=8000 and 8 bins.
    const bands = computeBandEnergiesNormalized(
      new Uint8Array([0, 255, 128, 64, 0, 255, 255, 0]),
      sampleRate,
      fftSize,
    );

    expect(bands.bass_energy).toBe(0); // no <250Hz bins in this tiny FFT setup
    expect(bands.mid_energy).toBeGreaterThan(0);
    expect(bands.high_energy).toBeGreaterThan(0);
  });

  it("extracts a complete AudioFeatures frame", () => {
    const features = extractAudioFeaturesFromFrame({
      timeDomain: [0.5, -0.5, 0.5, -0.5],
      frequency: [10, 200, 80, 30, 0, 0, 0, 0],
      sampleRate: 16000,
      fftSize: 16,
    });

    expect(features.rms).toBeGreaterThan(0);
    expect(features.zero_crossing_rate).toBeGreaterThan(0);
    expect(features.spectral_centroid).toBeGreaterThanOrEqual(0);
    expect(features.spectral_centroid).toBeLessThanOrEqual(1);
    expect(features.mid_energy).toBeGreaterThan(0);
    expect(features.high_energy).toBeGreaterThanOrEqual(0);
  });
});

