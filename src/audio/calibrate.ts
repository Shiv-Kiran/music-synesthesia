import type { AudioGateState } from "@/contracts/audio";

export const CALIBRATION_DURATION_MS = 3000;
export const ENERGY_THRESHOLD_MULTIPLIER = 1.4;
export const MIN_NOISE_FLOOR_RMS = 0.0015;
export const MAX_NOISE_FLOOR_RMS = 0.25;
export const MIN_ENERGY_THRESHOLD_RMS = 0.004;
export const MAX_ENERGY_THRESHOLD_RMS = 0.35;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeRms(samples: ArrayLike<number>): number {
  if (!samples.length) {
    return 0;
  }

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Number(samples[i]) || 0;
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / samples.length);
}

export function computeCalibrationProgress(
  elapsedMs: number,
  durationMs = CALIBRATION_DURATION_MS,
): number {
  if (durationMs <= 0) {
    return 1;
  }

  return clamp(elapsedMs / durationMs, 0, 1);
}

export function deriveNoiseFloorRms(rmsSamples: number[]): number {
  if (rmsSamples.length === 0) {
    return MIN_NOISE_FLOOR_RMS;
  }

  const finite = rmsSamples.filter(Number.isFinite);
  if (finite.length === 0) {
    return MIN_NOISE_FLOOR_RMS;
  }

  // Use the lower 80% as the calibration baseline so one short spike
  // (voice/clap) does not inflate the ambient floor in small sample windows.
  const sorted = [...finite].sort((a, b) => a - b);
  const keepCount = Math.max(1, Math.floor(sorted.length * 0.8));
  const baseline = sorted.slice(0, keepCount);
  const avg = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;

  return clamp(avg, MIN_NOISE_FLOOR_RMS, MAX_NOISE_FLOOR_RMS);
}

export function deriveEnergyThresholdRms(
  noiseFloorRms: number,
  multiplier = ENERGY_THRESHOLD_MULTIPLIER,
): number {
  const base = clamp(noiseFloorRms, MIN_NOISE_FLOOR_RMS, MAX_NOISE_FLOOR_RMS);
  return clamp(
    base * multiplier,
    MIN_ENERGY_THRESHOLD_RMS,
    MAX_ENERGY_THRESHOLD_RMS,
  );
}

export function createAudioGateStateFromCalibration(
  rmsSamples: number[],
  calibratedAt = Date.now(),
): AudioGateState {
  const noise_floor_rms = deriveNoiseFloorRms(rmsSamples);
  const energy_threshold_rms = deriveEnergyThresholdRms(noise_floor_rms);

  return {
    noise_floor_rms,
    energy_threshold_rms,
    gated_active: false,
    calibrated_at: calibratedAt,
  };
}
