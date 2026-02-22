import { computeRms } from "@/audio/calibrate";

export interface MicInputController {
  readonly audioContext: AudioContext;
  readonly analyser: AnalyserNode;
  readonly stream: MediaStream;
  readonly buffer: Float32Array;
  sampleRms: () => number;
  dispose: () => Promise<void>;
}

export interface MicInputOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  constraints?: MediaTrackConstraints;
}

const DEFAULT_MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

export function isMicSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export async function createMicInputController(
  options: MicInputOptions = {},
): Promise<MicInputController> {
  if (!isMicSupported()) {
    throw new Error("Microphone capture is not supported in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...DEFAULT_MIC_CONSTRAINTS,
      ...(options.constraints ?? {}),
    },
    video: false,
  });

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("AudioContext is not available in this browser.");
  }

  const audioContext = new AudioContextCtor();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = options.fftSize ?? 2048;
  analyser.smoothingTimeConstant = options.smoothingTimeConstant ?? 0.55;
  source.connect(analyser);

  const buffer = new Float32Array(analyser.fftSize);

  return {
    audioContext,
    analyser,
    stream,
    buffer,
    sampleRms: () => {
      analyser.getFloatTimeDomainData(buffer);
      return computeRms(buffer);
    },
    dispose: async () => {
      try {
        source.disconnect();
      } catch {
        // no-op
      }
      try {
        analyser.disconnect();
      } catch {
        // no-op
      }
      for (const track of stream.getTracks()) {
        track.stop();
      }
      if (audioContext.state !== "closed") {
        await audioContext.close();
      }
    },
  };
}

