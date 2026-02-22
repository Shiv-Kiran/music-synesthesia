import { EMPTY_AUDIO_FEATURES } from "@/audio/features";
import type { AudioFeatures } from "@/contracts/audio";
import type { PromptAudioContext } from "@/prompt/prompt-types";

export type PromptDetectedAudioEvent = "energy_spike" | "drop" | null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeAudioFeatures(features?: Partial<AudioFeatures> | null): AudioFeatures {
  const source = features ?? {};
  return {
    rms: clamp(source.rms ?? EMPTY_AUDIO_FEATURES.rms, 0, 2),
    bass_energy: clamp(source.bass_energy ?? EMPTY_AUDIO_FEATURES.bass_energy, 0, 1),
    mid_energy: clamp(source.mid_energy ?? EMPTY_AUDIO_FEATURES.mid_energy, 0, 1),
    high_energy: clamp(source.high_energy ?? EMPTY_AUDIO_FEATURES.high_energy, 0, 1),
    spectral_centroid: clamp(
      source.spectral_centroid ?? EMPTY_AUDIO_FEATURES.spectral_centroid,
      0,
      1,
    ),
    zero_crossing_rate: clamp(
      source.zero_crossing_rate ?? EMPTY_AUDIO_FEATURES.zero_crossing_rate,
      0,
      1,
    ),
    ...(typeof source.bpm_estimate === "number" ? { bpm_estimate: source.bpm_estimate } : {}),
  };
}

export function detectPromptAudioEvent(context: PromptAudioContext): PromptDetectedAudioEvent {
  if (!context.gate?.gated_active) {
    return null;
  }

  const current = normalizeAudioFeatures(context.current);
  const previous = context.previous ? normalizeAudioFeatures(context.previous) : null;
  if (!previous) {
    return null;
  }

  const rmsDelta = current.rms - previous.rms;
  const bassDelta = current.bass_energy - previous.bass_energy;
  const combinedEnergyDelta =
    (current.bass_energy + current.mid_energy + current.high_energy) / 3 -
    (previous.bass_energy + previous.mid_energy + previous.high_energy) / 3;

  const spike =
    (rmsDelta > 0.018 && bassDelta > 0.08) ||
    (rmsDelta > 0.03 && combinedEnergyDelta > 0.06);
  if (spike) {
    return "energy_spike";
  }

  const drop =
    previous.rms > Math.max((context.gate.energy_threshold_rms ?? 0) * 0.9, 0.01) &&
    current.rms < Math.max((context.gate.energy_threshold_rms ?? 0) * 0.6, 0.008) &&
    rmsDelta < -0.015;
  if (drop) {
    return "drop";
  }

  return null;
}

