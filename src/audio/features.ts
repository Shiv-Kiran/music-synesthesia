import { computeRms } from "@/audio/calibrate";
import type { AudioFeatures } from "@/contracts/audio";

export interface AudioFeatureBuffers {
  timeDomain: Float32Array<ArrayBuffer>;
  frequency: Uint8Array<ArrayBuffer>;
}

export interface AudioFeatureFrameInput {
  timeDomain: ArrayLike<number>;
  frequency: ArrayLike<number>; // Uint8 FFT magnitudes (0..255)
  sampleRate: number;
  fftSize: number;
}

export const EMPTY_AUDIO_FEATURES: AudioFeatures = {
  rms: 0,
  bass_energy: 0,
  mid_energy: 0,
  high_energy: 0,
  spectral_centroid: 0,
  zero_crossing_rate: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeFinite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function createAudioFeatureBuffers(fftSize: number): AudioFeatureBuffers {
  const safeFftSize = Math.max(32, Math.trunc(fftSize));
  return {
    timeDomain: new Float32Array(safeFftSize) as Float32Array<ArrayBuffer>,
    frequency: new Uint8Array(Math.floor(safeFftSize / 2)) as Uint8Array<ArrayBuffer>,
  };
}

export function computeZeroCrossingRate(timeDomain: ArrayLike<number>): number {
  if (timeDomain.length < 2) {
    return 0;
  }

  let crossings = 0;
  let prev = safeFinite(Number(timeDomain[0]));
  for (let i = 1; i < timeDomain.length; i += 1) {
    const current = safeFinite(Number(timeDomain[i]));
    const crosses =
      (prev >= 0 && current < 0) || (prev < 0 && current >= 0);
    if (crosses) {
      crossings += 1;
    }
    prev = current;
  }

  return crossings / (timeDomain.length - 1);
}

export function computeSpectralCentroidNormalized(
  frequency: ArrayLike<number>,
): number {
  if (frequency.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < frequency.length; i += 1) {
    const magnitude = clamp(safeFinite(Number(frequency[i])) / 255, 0, 1);
    weightedSum += i * magnitude;
    magnitudeSum += magnitude;
  }

  if (magnitudeSum <= 0) {
    return 0;
  }

  const centroidIndex = weightedSum / magnitudeSum;
  return clamp(centroidIndex / (frequency.length - 1 || 1), 0, 1);
}

export function computeBandEnergiesNormalized(
  frequency: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
): Pick<AudioFeatures, "bass_energy" | "mid_energy" | "high_energy"> {
  if (frequency.length === 0 || sampleRate <= 0 || fftSize <= 0) {
    return {
      bass_energy: 0,
      mid_energy: 0,
      high_energy: 0,
    };
  }

  const nyquist = sampleRate / 2;
  const binHz = nyquist / Math.max(1, frequency.length);

  let bassSum = 0;
  let bassCount = 0;
  let midSum = 0;
  let midCount = 0;
  let highSum = 0;
  let highCount = 0;

  for (let i = 0; i < frequency.length; i += 1) {
    const magnitude = clamp(safeFinite(Number(frequency[i])) / 255, 0, 1);
    const hz = i * binHz;

    if (hz < 20) {
      continue;
    }
    if (hz < 250) {
      bassSum += magnitude;
      bassCount += 1;
      continue;
    }
    if (hz < 2000) {
      midSum += magnitude;
      midCount += 1;
      continue;
    }
    if (hz <= 8000) {
      highSum += magnitude;
      highCount += 1;
    }
  }

  return {
    bass_energy: bassCount ? bassSum / bassCount : 0,
    mid_energy: midCount ? midSum / midCount : 0,
    high_energy: highCount ? highSum / highCount : 0,
  };
}

export function extractAudioFeaturesFromFrame(
  input: AudioFeatureFrameInput,
): AudioFeatures {
  const rms = clamp(computeRms(input.timeDomain), 0, 2);
  const zeroCrossing = computeZeroCrossingRate(input.timeDomain);
  const centroid = computeSpectralCentroidNormalized(input.frequency);
  const bands = computeBandEnergiesNormalized(
    input.frequency,
    input.sampleRate,
    input.fftSize,
  );

  return {
    rms,
    bass_energy: bands.bass_energy,
    mid_energy: bands.mid_energy,
    high_energy: bands.high_energy,
    spectral_centroid: centroid,
    zero_crossing_rate: zeroCrossing,
  };
}

export function sampleAudioFeatures(
  analyser: AnalyserNode,
  buffers: AudioFeatureBuffers,
): AudioFeatures {
  analyser.getFloatTimeDomainData(buffers.timeDomain);
  analyser.getByteFrequencyData(buffers.frequency);

  return extractAudioFeaturesFromFrame({
    timeDomain: buffers.timeDomain,
    frequency: buffers.frequency,
    sampleRate: analyser.context.sampleRate,
    fftSize: analyser.fftSize,
  });
}
