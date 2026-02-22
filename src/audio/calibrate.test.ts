import { describe, expect, it } from "vitest";

import {
  CALIBRATION_DURATION_MS,
  MIN_ENERGY_THRESHOLD_RMS,
  MIN_NOISE_FLOOR_RMS,
  computeCalibrationProgress,
  computeRms,
  createAudioGateStateFromCalibration,
  deriveEnergyThresholdRms,
  deriveNoiseFloorRms,
} from "@/audio/calibrate";

describe("audio calibration helpers", () => {
  it("computes RMS for sample windows", () => {
    const samples = [1, -1, 1, -1];
    expect(computeRms(samples)).toBeCloseTo(1);
    expect(computeRms([])).toBe(0);
  });

  it("computes calibration progress with clamping", () => {
    expect(computeCalibrationProgress(0)).toBe(0);
    expect(computeCalibrationProgress(CALIBRATION_DURATION_MS / 2)).toBeCloseTo(0.5);
    expect(computeCalibrationProgress(CALIBRATION_DURATION_MS * 2)).toBe(1);
  });

  it("derives a trimmed/clamped noise floor and threshold", () => {
    const noiseFloor = deriveNoiseFloorRms([0.003, 0.004, 0.0045, 0.2, 0.0042]);
    expect(noiseFloor).toBeGreaterThanOrEqual(MIN_NOISE_FLOOR_RMS);
    expect(noiseFloor).toBeLessThan(0.02);

    const threshold = deriveEnergyThresholdRms(noiseFloor);
    expect(threshold).toBeGreaterThanOrEqual(MIN_ENERGY_THRESHOLD_RMS);
    expect(threshold).toBeGreaterThan(noiseFloor);
  });

  it("creates AudioGateState from calibration samples", () => {
    const gate = createAudioGateStateFromCalibration([0.002, 0.003, 0.004], 12345);
    expect(gate.gated_active).toBe(false);
    expect(gate.calibrated_at).toBe(12345);
    expect(gate.energy_threshold_rms).toBeGreaterThan(gate.noise_floor_rms);
  });
});

