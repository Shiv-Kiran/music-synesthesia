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

export type TabAudioCaptureErrorCode =
  | "unsupported"
  | "no-audio-track"
  | "not-browser-tab";

export class TabAudioCaptureError extends Error {
  readonly code: TabAudioCaptureErrorCode;

  constructor(code: TabAudioCaptureErrorCode, message: string) {
    super(message);
    this.name = "TabAudioCaptureError";
    this.code = code;
  }
}

const DEFAULT_MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

function getAudioContextCtor():
  | typeof AudioContext
  | (typeof window & { webkitAudioContext?: typeof AudioContext })["webkitAudioContext"]
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

function isChromiumDesktopBrowser(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string; version: string }>;
      mobile?: boolean;
    };
  };

  if (nav.userAgentData) {
    const isMobile = Boolean(nav.userAgentData.mobile);
    if (isMobile) {
      return false;
    }

    const brands = nav.userAgentData.brands ?? [];
    return brands.some((entry) =>
      /Chromium|Google Chrome|Microsoft Edge/i.test(entry.brand),
    );
  }

  const ua = navigator.userAgent ?? "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  if (isMobile) {
    return false;
  }

  return /(Chrome|Chromium|Edg)\//.test(ua);
}

function stopMediaStreamTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function getDisplaySurfaceKind(track: MediaStreamTrack | null | undefined): string | null {
  if (!track) {
    return null;
  }

  const settings = track.getSettings() as MediaTrackSettings & {
    displaySurface?: string;
  };
  return typeof settings.displaySurface === "string" ? settings.displaySurface : null;
}

async function createInputControllerFromStream(
  stream: MediaStream,
  options: MicInputOptions = {},
): Promise<MicInputController> {
  const AudioContextCtor = getAudioContextCtor();

  if (!AudioContextCtor) {
    stopMediaStreamTracks(stream);
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
      stopMediaStreamTracks(stream);
      if (audioContext.state !== "closed") {
        await audioContext.close();
      }
    },
  };
}

export function isMicSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function isTabAudioCaptureSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    isChromiumDesktopBrowser() &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    !!getAudioContextCtor()
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

  return createInputControllerFromStream(stream, options);
}

export async function createTabAudioInputController(
  options: Omit<MicInputOptions, "constraints"> = {},
): Promise<MicInputController> {
  if (!isTabAudioCaptureSupported()) {
    throw new TabAudioCaptureError(
      "unsupported",
      "Tab audio capture is only supported on Chromium desktop browsers.",
    );
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  });

  const audioTrack = stream.getAudioTracks()[0] ?? null;
  if (!audioTrack) {
    stopMediaStreamTracks(stream);
    throw new TabAudioCaptureError(
      "no-audio-track",
      "No tab audio track was shared. Choose a browser tab and enable tab audio.",
    );
  }

  const videoTrack = stream.getVideoTracks()[0] ?? null;
  const displaySurface = getDisplaySurfaceKind(videoTrack);
  if (displaySurface !== "browser") {
    stopMediaStreamTracks(stream);
    throw new TabAudioCaptureError(
      "not-browser-tab",
      "Please choose a browser tab in the share picker (window/screen capture is not supported here).",
    );
  }

  return createInputControllerFromStream(stream, options);
}
