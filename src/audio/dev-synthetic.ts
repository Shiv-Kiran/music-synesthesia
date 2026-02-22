import type { AudioFeatures } from "@/contracts/audio";

export interface SyntheticAudioSource {
  sampleCalibrationRms: (elapsedMs: number) => number;
  sampleFeatures: (elapsedMs: number) => AudioFeatures;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function pulse(phase: number, sharpness = 8): number {
  const wrapped = fract(phase);
  return Math.exp(-wrapped * sharpness);
}

function sectionEnvelope(seconds: number): number {
  const cycleSeconds = 24;
  const t = ((seconds % cycleSeconds) + cycleSeconds) % cycleSeconds;

  if (t < 4) {
    return 0.12 + smoothstep(0, 4, t) * 0.1;
  }
  if (t < 10) {
    return 0.36 + smoothstep(4, 10, t) * 0.18;
  }
  if (t < 14) {
    return 0.72 + 0.08 * Math.sin((t - 10) * 2.4);
  }
  if (t < 15.4) {
    // hard drop window to trigger "drop" events deterministically
    return 0.05;
  }
  if (t < 20) {
    return 0.42 + smoothstep(15.4, 20, t) * 0.16;
  }

  // outro bar with periodic accents that can trigger energy spikes
  return 0.28 + (fract((t - 20) * 1.75) < 0.18 ? 0.28 : 0.04);
}

function sampleRuntimeFeatures(seconds: number): AudioFeatures {
  const envelope = sectionEnvelope(seconds);

  const beatPhase = seconds * 2.1; // ~126 BPM
  const offbeatPhase = seconds * 2.1 + 0.5;
  const kick = pulse(beatPhase, 10);
  const offbeat = pulse(offbeatPhase, 13);
  const shimmer = 0.5 + 0.5 * Math.sin(seconds * 5.2);
  const sweep = 0.5 + 0.5 * Math.sin(seconds * 0.33 + 1.1);

  const bass = clamp(envelope * (0.34 + kick * 0.92), 0, 1);
  const mid = clamp(envelope * (0.28 + offbeat * 0.55 + sweep * 0.18), 0, 1);
  const high = clamp(envelope * (0.14 + shimmer * 0.55), 0, 1);

  const combined = bass * 0.48 + mid * 0.34 + high * 0.18;
  const rms = clamp(0.0025 + combined * 0.052, 0, 0.22);
  const spectralCentroid = clamp(0.22 + high * 0.5 + sweep * 0.18, 0, 1);
  const zcr = clamp(0.04 + high * 0.36 + shimmer * 0.11, 0, 1);

  return {
    rms,
    bass_energy: bass,
    mid_energy: mid,
    high_energy: high,
    spectral_centroid: spectralCentroid,
    zero_crossing_rate: zcr,
  };
}

function sampleCalibrationRms(seconds: number): number {
  const floor = 0.0028;
  const flutter =
    0.0009 * (0.5 + 0.5 * Math.sin(seconds * 2.7)) +
    0.0005 * (0.5 + 0.5 * Math.sin(seconds * 7.4 + 1.3));
  return clamp(floor + flutter, 0.001, 0.008);
}

export function createSyntheticAudioSource(): SyntheticAudioSource {
  return {
    sampleCalibrationRms: (elapsedMs) => sampleCalibrationRms(Math.max(0, elapsedMs) / 1000),
    sampleFeatures: (elapsedMs) => sampleRuntimeFeatures(Math.max(0, elapsedMs) / 1000),
  };
}

