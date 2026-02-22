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

function sine(freqHz, seconds, phase = 0) {
  return Math.sin(2 * Math.PI * freqHz * seconds + phase);
}

function rhythmicPulse(seconds, bpm, subdivision, pattern, sharpness = 18) {
  const stepsPerSecond = (bpm / 60) * subdivision;
  const stepPosition = seconds * stepsPerSecond;
  const stepIndex = Math.floor(stepPosition);
  const localPhase = fract(stepPosition);
  const patternIndex = ((stepIndex % pattern.length) + pattern.length) % pattern.length;
  const hit = pattern[patternIndex] ?? 0;
  if (hit <= 0) {
    return 0;
  }
  return hit * Math.exp(-localPhase * sharpness);
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

function sampleSteadyPulseWave(seconds, sampleIndex, seed = 11) {
  const bpm = 112;
  const beat = bpm / 60;
  const kick = rhythmicPulse(seconds, bpm, 1, [1, 0, 0.65, 0], 8.5);
  const ghostKick = rhythmicPulse(seconds, bpm, 2, [0, 0.12, 0, 0, 0, 0.08, 0, 0], 14);
  const clap = rhythmicPulse(seconds, bpm, 1, [0, 0.45, 0, 0.45], 17);
  const hat = rhythmicPulse(
    seconds,
    bpm,
    4,
    [0.6, 0.15, 0.48, 0.12, 0.56, 0.12, 0.44, 0.14],
    26,
  );

  const sweep = 0.5 + 0.5 * Math.sin(seconds * 0.18 + 0.6);
  const padDrift = 0.5 + 0.5 * Math.sin(seconds * 0.07 + 2.2);
  const sub = sine(48, seconds);
  const bass = sine(70 + 12 * sweep, seconds + 0.0006 * kick);
  const padA = sine(176 + padDrift * 26, seconds, 0.3);
  const padB = sine(264 + sweep * 38, seconds, 1.2);
  const noise = noise01(sampleIndex, seed) * 2 - 1;

  const kickLayer = (sub * 0.8 + bass * 0.35) * (0.14 + kick * 0.95 + ghostKick * 0.35);
  const padLayer = (padA * 0.5 + padB * 0.38) * (0.16 + 0.28 * padDrift + clap * 0.12);
  const hatLayer = noise * (0.01 + hat * 0.08 + clap * 0.02);

  const sectionMod = 0.7 + 0.3 * Math.sin(seconds * beat * 0.25 + 0.4);
  return softClip((kickLayer + padLayer + hatLayer) * sectionMod * 0.78);
}

function sampleHalftimeThumpWave(seconds, sampleIndex, seed = 19) {
  const bpm = 86;
  const kick = rhythmicPulse(seconds, bpm, 1, [1, 0, 0, 0.55], 7.5);
  const snare = rhythmicPulse(seconds, bpm, 2, [0, 0, 0.8, 0, 0, 0, 0.65, 0], 14);
  const hat = rhythmicPulse(
    seconds,
    bpm,
    4,
    [0.16, 0.42, 0.14, 0.38, 0.12, 0.46, 0.14, 0.4],
    20,
  );
  const rumbleEnv = 0.45 + 0.55 * Math.sin(seconds * 0.23 + 0.8);
  const sub = sine(42, seconds);
  const lowGrowl = sine(58 + rumbleEnv * 10, seconds, 0.2);
  const midTone = sine(145 + 20 * rumbleEnv, seconds, 0.7);
  const texture = (noise01(sampleIndex, seed) * 2 - 1) * (0.01 + hat * 0.045 + snare * 0.03);

  const thump = (sub * 0.9 + lowGrowl * 0.45) * (0.1 + kick * 1.05);
  const body = midTone * (0.12 + snare * 0.22 + rumbleEnv * 0.08);
  const air = texture + sine(600 + 40 * rumbleEnv, seconds) * hat * 0.018;

  const swell = 0.78 + 0.22 * Math.sin(seconds * 0.09 + 1.4);
  return softClip((thump + body + air) * swell * 0.86);
}

function sampleBrokenBeatWave(seconds, sampleIndex, seed = 27) {
  const bpm = 132;
  const kick = rhythmicPulse(
    seconds,
    bpm,
    4,
    [1, 0, 0.0, 0, 0.35, 0, 0.65, 0, 0.0, 0, 0.25, 0, 0.8, 0, 0.0, 0.15],
    14,
  );
  const snare = rhythmicPulse(
    seconds,
    bpm,
    4,
    [0, 0, 0.55, 0, 0, 0.2, 0, 0, 0.65, 0, 0.35, 0, 0, 0.25, 0.5, 0],
    17,
  );
  const hat = rhythmicPulse(
    seconds,
    bpm,
    8,
    [0.42, 0.08, 0.22, 0.12, 0.34, 0.06, 0.16, 0.1, 0.38, 0.08, 0.2, 0.12, 0.28, 0.08, 0.14, 0.1],
    28,
  );

  const seq = [0, 3, 7, 10, 7, 3, 12, 10];
  const seqStep = Math.floor(seconds * (bpm / 60) * 2) % seq.length;
  const note = seq[seqStep];
  const freqBase = 92 * Math.pow(2, note / 12);
  const wobble = 0.5 + 0.5 * Math.sin(seconds * 2.2);
  const bass = sine(freqBase * (0.5 + wobble * 0.08), seconds, 0.15);
  const fm = sine(freqBase * 2.0 + 40 * wobble, seconds + 0.0004 * kick, 0.4);
  const grain = noise01(sampleIndex, seed) * 2 - 1;

  const low = (bass * 0.9 + sine(48, seconds) * 0.45) * (0.08 + kick * 0.95);
  const mid = fm * (0.08 + snare * 0.25 + 0.08 * wobble);
  const perc = grain * (0.01 + hat * 0.065 + snare * 0.02);
  const pulseBed = sine(220 + note * 8, seconds, 1.1) * (0.02 + hat * 0.03);

  return softClip((low + mid + perc + pulseBed) * 0.82);
}

function sampleKickGridWave(seconds, sampleIndex, seed = 53) {
  const bpm = 126;
  const kick = rhythmicPulse(
    seconds,
    bpm,
    4,
    [1, 0, 0, 0, 0.9, 0, 0.22, 0, 1, 0, 0.0, 0, 0.78, 0, 0.18, 0.12],
    13.5,
  );
  const ghostKick = rhythmicPulse(seconds, bpm, 8, [0, 0, 0.12, 0, 0, 0, 0.08, 0], 22);
  const snare = rhythmicPulse(seconds, bpm, 4, [0, 0, 0.78, 0, 0, 0, 0.72, 0], 18);
  const hat = rhythmicPulse(
    seconds,
    bpm,
    8,
    [0.44, 0.08, 0.24, 0.12, 0.38, 0.06, 0.3, 0.1, 0.4, 0.08, 0.26, 0.1, 0.36, 0.08, 0.28, 0.1],
    28,
  );

  const pitchDrop = Math.exp(-fract(seconds * (bpm / 60) * 4) * 14);
  const sub = sine(44, seconds);
  const kickBody = sine(58 + pitchDrop * 26, seconds, 0.05);
  const click = sine(1900 + 420 * pitchDrop, seconds) * (kick + ghostKick * 0.5);
  const snareBody = sine(190 + 34 * Math.sin(seconds * 0.5), seconds, 0.4) * snare;
  const noise = noise01(sampleIndex, seed) * 2 - 1;

  const low = (sub * 0.9 + kickBody * 0.55) * (0.06 + kick * 1.1 + ghostKick * 0.35);
  const mid = snareBody * (0.06 + snare * 0.25);
  const perc = noise * (0.012 + hat * 0.075 + snare * 0.045) + click * 0.028;
  const drive = 0.88 + 0.12 * Math.sin(seconds * 0.12 + 0.7);

  return softClip((low + mid + perc) * drive * 0.9);
}

function sampleTransientSnapWave(seconds, sampleIndex, seed = 59) {
  const bpm = 138;
  const kick = rhythmicPulse(seconds, bpm, 4, [0.9, 0, 0.0, 0.18, 0.68, 0, 0.2, 0, 0.82, 0, 0, 0.14, 0.74, 0, 0.28, 0], 16);
  const snare = rhythmicPulse(seconds, bpm, 4, [0, 0.0, 0.62, 0, 0, 0.2, 0.0, 0, 0.76, 0, 0.24, 0, 0, 0.26, 0.56, 0], 22);
  const hat = rhythmicPulse(
    seconds,
    bpm,
    16,
    [0.42, 0.06, 0.24, 0.08, 0.34, 0.08, 0.18, 0.06, 0.4, 0.06, 0.22, 0.08, 0.32, 0.08, 0.2, 0.06],
    34,
  );
  const shaker = rhythmicPulse(seconds, bpm, 16, new Array(16).fill(0.16), 38);

  const sub = sine(47, seconds);
  const lowTone = sine(72 + 8 * Math.sin(seconds * 0.33), seconds, 0.15);
  const snareTone = sine(230, seconds, 0.9) * snare;
  const noise = noise01(sampleIndex, seed) * 2 - 1;
  const hiss = noise01(sampleIndex + 91, seed + 13) * 2 - 1;

  const low = (sub * 0.8 + lowTone * 0.35) * (0.05 + kick * 0.95);
  const sn = snareTone * (0.05 + snare * 0.24);
  const highs = noise * (0.01 + hat * 0.085 + snare * 0.04) + hiss * (0.006 + shaker * 0.03);
  const transientBias = 0.9 + 0.1 * (fract(seconds * (bpm / 60)) < 0.5 ? 1 : -1);

  return softClip((low + sn + highs) * transientBias * 0.86);
}

function sampleTomRushWave(seconds, sampleIndex, seed = 61) {
  const bpm = 104;
  const kick = rhythmicPulse(seconds, bpm, 2, [1, 0, 0.0, 0.42, 0.84, 0, 0.0, 0.3], 12);
  const tomA = rhythmicPulse(seconds, bpm, 4, [0.0, 0.56, 0.0, 0.18, 0.0, 0.48, 0.0, 0.22, 0.0, 0.62, 0.0, 0.2, 0.0, 0.44, 0.0, 0.24], 16);
  const tomB = rhythmicPulse(seconds, bpm, 4, [0.0, 0.0, 0.38, 0.0, 0.0, 0.0, 0.46, 0.0, 0.0, 0.0, 0.34, 0.0, 0.0, 0.0, 0.52, 0.0], 18);
  const rim = rhythmicPulse(seconds, bpm, 8, [0.12, 0, 0.0, 0.06, 0.1, 0, 0.0, 0.08], 30);
  const hat = rhythmicPulse(seconds, bpm, 8, [0.24, 0.06, 0.18, 0.08, 0.22, 0.06, 0.2, 0.08], 26);

  const sub = sine(43, seconds);
  const kickTone = sine(60 + 18 * Math.exp(-fract(seconds * (bpm / 60) * 2) * 9), seconds);
  const tomToneA = sine(118, seconds, 0.2);
  const tomToneB = sine(154, seconds, 1.0);
  const rimTone = sine(980, seconds, 0.4);
  const noise = noise01(sampleIndex, seed) * 2 - 1;

  const low = (sub * 0.85 + kickTone * 0.45) * (0.06 + kick * 1.0);
  const toms = tomToneA * tomA * 0.32 + tomToneB * tomB * 0.28;
  const top = rimTone * rim * 0.03 + noise * (0.008 + hat * 0.05 + rim * 0.02);
  const movement = 0.84 + 0.16 * Math.sin(seconds * 0.18 + 1.3);

  return softClip((low + toms + top) * movement * 0.88);
}

function samplePeacefulDriftWave(seconds, sampleIndex, seed = 43) {
  const bpm = 72;
  const softPulse = rhythmicPulse(seconds, bpm, 1, [0.35, 0, 0.22, 0], 6);
  const shimmerPulse = rhythmicPulse(seconds, bpm, 4, [0.08, 0, 0.04, 0, 0.06, 0, 0.03, 0], 16);
  const swell = 0.5 + 0.5 * Math.sin(seconds * 0.11 + 0.9);
  const drift = 0.5 + 0.5 * Math.sin(seconds * 0.06 + 2.1);

  const sub = sine(44, seconds) * (0.05 + softPulse * 0.08);
  const padA = sine(132 + swell * 12, seconds, 0.2);
  const padB = sine(198 + drift * 18, seconds, 1.0);
  const padC = sine(264 + swell * 14, seconds, 2.2);
  const motion = sine(330 + drift * 28, seconds, 0.8);
  const air = (noise01(sampleIndex, seed) * 2 - 1) * (0.005 + shimmerPulse * 0.018);

  const bed = (padA * 0.5 + padB * 0.35 + padC * 0.2) * (0.13 + swell * 0.14);
  const halo = motion * (0.02 + shimmerPulse * 0.04 + drift * 0.015);

  return softClip((sub + bed + halo + air) * 0.62);
}

function sampleStompDriveWave(seconds, sampleIndex, seed = 47) {
  const bpm = 120;
  const kick = rhythmicPulse(
    seconds,
    bpm,
    4,
    [1, 0, 0.24, 0, 0.86, 0, 0.18, 0, 0.94, 0, 0.16, 0.1, 0.8, 0, 0.22, 0],
    13,
  );
  const snare = rhythmicPulse(
    seconds,
    bpm,
    4,
    [0, 0, 0.72, 0, 0, 0.16, 0.46, 0, 0, 0.12, 0.64, 0, 0, 0.18, 0.52, 0],
    18,
  );
  const hat = rhythmicPulse(
    seconds,
    bpm,
    8,
    [0.26, 0.08, 0.2, 0.1, 0.3, 0.06, 0.18, 0.1, 0.24, 0.08, 0.22, 0.1, 0.28, 0.08, 0.2, 0.1],
    28,
  );
  const clap = rhythmicPulse(seconds, bpm, 2, [0, 0.28, 0, 0.34, 0, 0.22, 0, 0.3], 20);

  const drive = 0.5 + 0.5 * Math.sin(seconds * 0.17 + 1.1);
  const wobble = 0.5 + 0.5 * Math.sin(seconds * 0.41 + 0.7);
  const sub = sine(46, seconds);
  const bass = sine(68 + 10 * wobble, seconds, 0.1);
  const body = sine(122 + 18 * drive, seconds, 0.45);
  const top = sine(860 + 80 * drive, seconds, 0.2);
  const grit = (noise01(sampleIndex, seed) * 2 - 1) * (0.01 + hat * 0.055 + snare * 0.03);

  const low = (sub * 0.85 + bass * 0.46) * (0.07 + kick * 1.02);
  const mid = body * (0.05 + snare * 0.22 + clap * 0.08);
  const high = top * (0.008 + hat * 0.02 + clap * 0.012) + grit;

  return softClip((low + mid + high) * (0.84 + drive * 0.12) * 0.88);
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

function renderClip({ fileName, startSeconds, durationSeconds, seed = 1, sampler = sampleSyntheticWave }) {
  const sampleCount = Math.floor(durationSeconds * SAMPLE_RATE);
  const samples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const seconds = startSeconds + i / SAMPLE_RATE;
    samples[i] = sampler(seconds, i, seed);
  }

  const outputPath = path.resolve("public", "dev-audio", fileName);
  writeWavPcm16Mono(outputPath, samples);
  return { outputPath, sampleCount };
}

const clips = [
  {
    fileName: "qualia-demo-kick-grid-16s.wav",
    startSeconds: 0,
    durationSeconds: 16,
    label: "Kick grid loop",
    seed: 53,
    sampler: sampleKickGridWave,
  },
  {
    fileName: "qualia-demo-transient-snap-16s.wav",
    startSeconds: 0,
    durationSeconds: 16,
    label: "Transient snap loop",
    seed: 59,
    sampler: sampleTransientSnapWave,
  },
  {
    fileName: "qualia-demo-broken-beat-16s.wav",
    startSeconds: 0,
    durationSeconds: 16,
    label: "Broken beat loop",
    seed: 27,
    sampler: sampleBrokenBeatWave,
  },
  {
    fileName: "qualia-demo-tom-rush-16s.wav",
    startSeconds: 0,
    durationSeconds: 16,
    label: "Tom rush loop",
    seed: 61,
    sampler: sampleTomRushWave,
  },
  {
    fileName: "qualia-demo-peaceful-drift-16s.wav",
    startSeconds: 0,
    durationSeconds: 16,
    label: "Peaceful drift loop",
    seed: 43,
    sampler: samplePeacefulDriftWave,
  },
  {
    fileName: "qualia-demo-stomp-drive-16s.wav",
    startSeconds: 0,
    durationSeconds: 16,
    label: "Stomp drive loop",
    seed: 47,
    sampler: sampleStompDriveWave,
  },
];

console.log("Exporting deterministic synthetic demo WAV clips...");
for (const clip of clips) {
  const result = renderClip(clip);
  console.log(
    `- ${clip.fileName} (${clip.label}) -> ${result.outputPath} [${result.sampleCount} samples]`,
  );
}

