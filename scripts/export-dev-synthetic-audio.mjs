import fs from "node:fs";
import path from "node:path";

const SAMPLE_RATE = 44_100;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function fract(value) {
  return value - Math.floor(value);
}

function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function pulse(phase, sharpness = 8) {
  const wrapped = fract(phase);
  return Math.exp(-wrapped * sharpness);
}

function noise01(sampleIndex, seed) {
  // Deterministic hash-noise; no RNG state needed.
  const x = Math.sin((sampleIndex + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return fract(x);
}

function sectionEnvelope(seconds) {
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
    return 0.05;
  }
  if (t < 20) {
    return 0.42 + smoothstep(15.4, 20, t) * 0.16;
  }
  return 0.28 + (fract((t - 20) * 1.75) < 0.18 ? 0.28 : 0.04);
}

function softClip(x) {
  // Gentle tanh clip to keep levels sane.
  return Math.tanh(x * 1.6) / Math.tanh(1.6);
}

function sampleSyntheticWave(seconds, sampleIndex, seed = 1) {
  const env = sectionEnvelope(seconds);

  const beatHz = 2.1; // ~126 BPM quarter-note accents
  const kickPulse = pulse(seconds * beatHz, 9.5);
  const offPulse = pulse(seconds * beatHz + 0.5, 12.5);
  const hatPulse = pulse(seconds * beatHz * 2.0 + 0.12, 20);

  const sweep = 0.5 + 0.5 * Math.sin(seconds * 0.33 + 1.1);
  const shimmer = 0.5 + 0.5 * Math.sin(seconds * 5.2);

  const sub = Math.sin(2 * Math.PI * 55 * seconds);
  const bass = Math.sin(2 * Math.PI * (82 + 14 * sweep) * seconds);
  const midA = Math.sin(2 * Math.PI * (220 + 65 * sweep) * seconds + 0.35);
  const midB = Math.sin(2 * Math.PI * (330 + 90 * shimmer) * seconds + 0.9);
  const air = noise01(sampleIndex, seed) * 2 - 1;

  const kickLayer = (sub * 0.6 + bass * 0.4) * (0.18 + 0.82 * kickPulse);
  const midLayer = (midA * 0.55 + midB * 0.45) * (0.22 + 0.55 * offPulse);
  const highLayer = air * (0.03 + 0.12 * hatPulse + 0.06 * shimmer);

  const slowBed = Math.sin(2 * Math.PI * 110 * seconds) * 0.05;
  const dropHollow = seconds % 24 > 14 && seconds % 24 < 15.4 ? -0.02 * air : 0;

  const raw =
    env * (kickLayer * 0.95 + midLayer * 0.6 + highLayer) +
    slowBed * (0.4 + env * 0.5) +
    dropHollow;

  return softClip(raw * 0.9);
}

function writeWavPcm16Mono(filePath, samples, sampleRate = SAMPLE_RATE) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  let offset = 0;
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // PCM chunk size
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < samples.length; i += 1) {
    const s = clamp(samples[i], -1, 1);
    buffer.writeInt16LE(Math.round(s * 32767), offset);
    offset += 2;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

function renderClip({ fileName, startSeconds, durationSeconds, seed = 1 }) {
  const sampleCount = Math.floor(durationSeconds * SAMPLE_RATE);
  const samples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const seconds = startSeconds + i / SAMPLE_RATE;
    samples[i] = sampleSyntheticWave(seconds, i, seed);
  }

  const outputPath = path.resolve("public", "dev-audio", fileName);
  writeWavPcm16Mono(outputPath, samples);
  return { outputPath, sampleCount };
}

const clips = [
  {
    fileName: "qualia-demo-loop-24s.wav",
    startSeconds: 0,
    durationSeconds: 24,
    label: "Full 24s loop (build, peak, drop, accents)",
  },
  {
    fileName: "qualia-demo-build-0-10s.wav",
    startSeconds: 0,
    durationSeconds: 10,
    label: "Early build section",
  },
  {
    fileName: "qualia-demo-peak-10-14s.wav",
    startSeconds: 10,
    durationSeconds: 4,
    label: "Peak section",
  },
  {
    fileName: "qualia-demo-drop-14-18s.wav",
    startSeconds: 14,
    durationSeconds: 4,
    label: "Drop + recovery section",
  },
  {
    fileName: "qualia-demo-accents-20-24s.wav",
    startSeconds: 20,
    durationSeconds: 4,
    label: "Accent section (spike-friendly)",
  },
];

console.log("Exporting deterministic synthetic demo WAV clips...");
for (const clip of clips) {
  const result = renderClip(clip);
  console.log(
    `- ${clip.fileName} (${clip.label}) -> ${result.outputPath} [${result.sampleCount} samples]`,
  );
}

