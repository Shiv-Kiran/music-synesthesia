"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  CALIBRATION_DURATION_MS,
  computeCalibrationProgress,
  createAudioGateStateFromCalibration,
} from "@/audio/calibrate";
import {
  getDevDemoAudioClipById,
} from "@/audio/dev-demo-clips";
import {
  createSyntheticAudioSource,
  type SyntheticAudioSource,
} from "@/audio/dev-synthetic";
import {
  createEnergyGateMachine,
  stepEnergyGate,
  type EnergyGateMachine,
} from "@/audio/energy-gate";
import {
  EMPTY_AUDIO_FEATURES,
  createAudioFeatureBuffers,
  sampleAudioFeatures,
  type AudioFeatureBuffers,
} from "@/audio/features";
import { createMicInputController, isMicSupported, type MicInputController } from "@/audio/mic";
import type { AudioFeatures, AudioGateState } from "@/contracts/audio";
import { PROMPT_LIBRARY } from "@/content/prompts";
import {
  createPromptMachineState,
  respondToPrompt,
  tickPromptMachine,
} from "@/prompt/machine";
import { detectPromptAudioEvent } from "@/prompt/triggers";
import type {
  PromptMachineEvent,
  PromptMachineState,
} from "@/prompt/prompt-types";
import { useQualiaStore } from "@/state/qualia-store";
import { MicCalibrationScreen } from "@/ui/MicCalibrationScreen";
import { MoodBar } from "@/ui/MoodBar";
import { MicPermissionScreen } from "@/ui/MicPermissionScreen";
import { PromptOverlay } from "@/ui/PromptOverlay";
import { MicTestScreen } from "@/ui/MicTestScreen";
import { SessionCanvas } from "@/ui/SessionCanvas";

type MicFlowPhase =
  | "permission"
  | "requesting"
  | "calibrating"
  | "mic-test"
  | "ready";

type SessionInputMode = "mic" | "synthetic" | "dev-demo-audio";

interface MicPreviewStats {
  rms: number;
  noiseFloorRms: number;
  thresholdRms: number;
  gateActive: boolean;
}

interface MicFeatureStats extends AudioFeatures {
  gateActive: boolean;
}

const INITIAL_PREVIEW_STATS: MicPreviewStats = {
  rms: 0,
  noiseFloorRms: 0,
  thresholdRms: 0,
  gateActive: false,
};

const INITIAL_FEATURE_STATS: MicFeatureStats = {
  ...EMPTY_AUDIO_FEATURES,
  gateActive: false,
};

interface PromptResponseDebug {
  chipLabel: string;
  responseLatencyMs: number;
  promptText: string;
  atMs: number;
}

function getNowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function getMicErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Could not access the microphone. Please try again.";
  }

  const domError = error as DOMException;
  if (domError.name === "NotAllowedError") {
    return "Microphone permission was blocked. Allow mic access and try again.";
  }
  if (domError.name === "NotFoundError") {
    return "No microphone was found on this device.";
  }
  if (domError.name === "NotReadableError") {
    return "Microphone is busy in another app. Close it and try again.";
  }

  return domError.message || "Could not access the microphone. Please try again.";
}

const PROMPT_DEFINITION_BY_ID = Object.fromEntries(
  PROMPT_LIBRARY.map((definition) => [definition.id, definition]),
);

export function MicSessionFlow() {
  const resetVisualState = useQualiaStore((state) => state.resetVisualState);
  const applyDelta = useQualiaStore((state) => state.applyDelta);
  const setAudioFeatures = useQualiaStore((state) => state.setAudioFeatures);
  const setAudioGateState = useQualiaStore((state) => state.setAudioGateState);

  const [phase, setPhase] = useState<MicFlowPhase>("permission");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [previewStats, setPreviewStats] = useState<MicPreviewStats>(INITIAL_PREVIEW_STATS);
  const [featureStats, setFeatureStats] = useState<MicFeatureStats>(INITIAL_FEATURE_STATS);
  const [autoAdvanceInMs, setAutoAdvanceInMs] = useState<number | null>(null);
  const [inputMode, setInputMode] = useState<SessionInputMode | null>(null);
  const [activeDevDemoClipId, setActiveDevDemoClipId] = useState<string | null>(null);
  const [devDemoPlaying, setDevDemoPlaying] = useState(false);
  const [devDemoPlaybackError, setDevDemoPlaybackError] = useState<string | null>(null);
  const [promptMachineState, setPromptMachineState] = useState<PromptMachineState>(() =>
    createPromptMachineState(0),
  );
  const [promptZoneHeld, setPromptZoneHeld] = useState(false);
  const [lastPromptResponse, setLastPromptResponse] = useState<PromptResponseDebug | null>(null);

  const micControllerRef = useRef<MicInputController | null>(null);
  const syntheticAudioSourceRef = useRef<SyntheticAudioSource | null>(null);
  const inputModeRef = useRef<SessionInputMode | null>(null);
  const featureBuffersRef = useRef<AudioFeatureBuffers | null>(null);
  const gateStateRef = useRef<AudioGateState | null>(null);
  const gateMachineRef = useRef<EnergyGateMachine | null>(null);
  const rafRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<number[]>([]);
  const calibrationStartedAtRef = useRef<number>(0);
  const micTestStartedAtRef = useRef<number>(0);
  const heardSignalAtRef = useRef<number | null>(null);
  const lastUiStatsAtRef = useRef<number>(0);
  const lastStoreAudioWriteAtRef = useRef<number>(0);
  const autoAdvanceDeadlineRef = useRef<number | null>(null);
  const disposedRef = useRef(false);
  const sessionStartedAtRef = useRef<number>(0);
  const promptMachineRef = useRef<PromptMachineState>(createPromptMachineState(0));
  const previousAudioFeaturesForPromptRef = useRef<AudioFeatures | null>(null);
  const lastPromptUiSyncAtRef = useRef<number>(0);
  const promptZoneHeldRef = useRef(false);
  const settleVisualPreviewRef = useRef<(active: boolean, intensity?: number) => void>(
    () => {},
  );
  const devDemoAudioRef = useRef<HTMLAudioElement | null>(null);
  const devDemoPreviewRafRef = useRef<number | null>(null);
  const devDemoAudioContextRef = useRef<AudioContext | null>(null);
  const devDemoAudioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const devDemoAnalyserRef = useRef<AnalyserNode | null>(null);
  const devDemoAnalyserBuffersRef = useRef<AudioFeatureBuffers | null>(null);

  const supported = useSyncExternalStore<boolean | null>(
    () => () => {},
    () => isMicSupported(),
    () => null,
  );
  const devBypassEnabled = process.env.NODE_ENV !== "production";

  function stopLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function stopDevDemoPreviewLoop() {
    if (devDemoPreviewRafRef.current !== null) {
      cancelAnimationFrame(devDemoPreviewRafRef.current);
      devDemoPreviewRafRef.current = null;
    }
  }

  useEffect(() => {
    resetVisualState();
    const demoAudio = devDemoAudioRef.current;
    return () => {
      disposedRef.current = true;
      stopLoop();
      stopDevDemoPreviewLoop();
      if (demoAudio) {
        demoAudio.pause();
        demoAudio.src = "";
      }
      const controller = micControllerRef.current;
      micControllerRef.current = null;
      syntheticAudioSourceRef.current = null;
      inputModeRef.current = null;
      featureBuffersRef.current = null;
      setInputMode(null);
      setActiveDevDemoClipId(null);
      setDevDemoPlaying(false);
      setDevDemoPlaybackError(null);
      try {
        devDemoAudioSourceNodeRef.current?.disconnect();
      } catch {
        // no-op
      }
      try {
        devDemoAnalyserRef.current?.disconnect();
      } catch {
        // no-op
      }
      devDemoAudioSourceNodeRef.current = null;
      devDemoAnalyserRef.current = null;
      devDemoAnalyserBuffersRef.current = null;
      const demoAudioContext = devDemoAudioContextRef.current;
      devDemoAudioContextRef.current = null;
      setAudioFeatures({ ...EMPTY_AUDIO_FEATURES });
      setAudioGateState(null);
      void demoAudioContext?.close();
      void controller?.dispose();
    };
  }, [resetVisualState, setAudioFeatures, setAudioGateState]);

  const resetPromptMachineRuntime = (nowMs = 0) => {
    const nextPromptState = createPromptMachineState(nowMs);
    promptMachineRef.current = nextPromptState;
    lastPromptUiSyncAtRef.current = 0;
    previousAudioFeaturesForPromptRef.current = null;
    promptZoneHeldRef.current = false;
    setPromptMachineState(nextPromptState);
    setPromptZoneHeld(false);
    setLastPromptResponse(null);
  };

  const syncPromptUiState = (
    nextPromptState: PromptMachineState,
    nowMs: number,
    force = false,
  ) => {
    if (force || nowMs - lastPromptUiSyncAtRef.current >= 100) {
      lastPromptUiSyncAtRef.current = nowMs;
      setPromptMachineState(nextPromptState);
    }
  };

  const handlePromptEvents = (events: PromptMachineEvent[], nowMs: number) => {
    for (const event of events) {
      if (event.type !== "prompt_responded") {
        continue;
      }

      setLastPromptResponse({
        chipLabel: event.chip_label,
        responseLatencyMs: event.response_latency_ms,
        promptText: event.prompt.text,
        atMs: nowMs,
      });
    }
  };

  const settleVisualPreview = useCallback((active: boolean, intensity = 0) => {
    if (active) {
      const clamped = Math.min(Math.max(intensity, 0), 2.4);
      applyDelta({
        set: {
          pulse_strength: Math.min(0.24 + clamped * 0.26, 1),
          turbulence: Math.min(0.17 + clamped * 0.11, 1),
          brightness: Math.min(0.22 + clamped * 0.022, 0.33),
          hue_chaos: Math.min(0.07 + clamped * 0.022, 0.18),
          particle_density: Math.min(0.23 + clamped * 0.075, 1),
          wave_speed: Math.min(0.28 + clamped * 0.1, 2),
          blur: Math.max(0.055, 0.09 - clamped * 0.007),
        },
        lerp_ms: 130,
        source: "audio",
      });
      return;
    }

    applyDelta({
      set: {
        pulse_strength: 0.2,
        turbulence: 0.18,
        brightness: 0.25,
        hue_chaos: 0.1,
        particle_density: 0.28,
        wave_speed: 0.3,
        blur: 0.085,
      },
      lerp_ms: 320,
      source: "audio",
    });
  }, [applyDelta]);

  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
  const clampWaveSpeed = (value: number) => Math.min(Math.max(value, 0), 2);

  const applyAudioReactivePreview = (
    features: AudioFeatures,
    gateActive: boolean,
    intensity: number,
  ) => {
    if (!gateActive) {
      settleVisualPreview(false);
      return;
    }

    const intensityBias = Math.min(Math.max(intensity, 0), 2.4);
    const transient = clamp01(
      features.bass_energy * 0.34 +
        features.high_energy * 0.12 +
        features.zero_crossing_rate * 0.45 +
        Math.max(0, features.rms - 0.02) * 5.8,
    );
    const impact = clamp01(
      features.bass_energy * 0.5 +
        features.rms * 2.0 +
        transient * 0.5 +
        intensityBias * 0.04,
    );
    const textureDrive = clamp01(
      features.mid_energy * 0.48 + features.high_energy * 0.1 + transient * 0.1,
    );
    const brightnessLift = clamp01(features.rms * 0.5 + features.spectral_centroid * 0.035);

    applyDelta({
      set: {
        pulse_strength: clamp01(0.16 + impact * 0.68),
        turbulence: clamp01(0.1 + textureDrive * 0.34 + transient * 0.08),
        brightness: clamp01(0.2 + brightnessLift * 0.08 + impact * 0.035),
        hue_chaos: clamp01(0.05 + features.high_energy * 0.05 + transient * 0.035),
        particle_density: clamp01(
          0.18 + features.mid_energy * 0.16 + features.high_energy * 0.06 + transient * 0.04,
        ),
        wave_speed: clampWaveSpeed(
          0.16 + features.bass_energy * 0.34 + features.mid_energy * 0.16 + transient * 0.06,
        ),
        blur: clamp01(0.055 + (1 - features.spectral_centroid) * 0.04 - impact * 0.01),
      },
      lerp_ms: 140,
      source: "audio",
    });
  };
  useEffect(() => {
    settleVisualPreviewRef.current = settleVisualPreview;
  }, [settleVisualPreview]);

  useEffect(() => {
    const audio = devDemoAudioRef.current;
    if (!audio) {
      return;
    }

    const handlePlay = () => setDevDemoPlaying(true);
    const handlePause = () => {
      setDevDemoPlaying(false);
      stopDevDemoPreviewLoop();
      settleVisualPreviewRef.current(false);
    };
    const handleEnded = () => {
      setDevDemoPlaying(false);
      stopDevDemoPreviewLoop();
      settleVisualPreviewRef.current(false);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const ensureDevDemoAudioAnalyser = async (): Promise<{
    analyser: AnalyserNode;
    buffers: AudioFeatureBuffers;
  }> => {
    const audio = devDemoAudioRef.current;
    if (!audio) {
      throw new Error("Demo audio element is not available.");
    }

    let audioContext = devDemoAudioContextRef.current;
    if (!audioContext) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Web Audio is not supported in this browser.");
      }

      audioContext = new AudioContextCtor();
      devDemoAudioContextRef.current = audioContext;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    let analyser = devDemoAnalyserRef.current;
    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      devDemoAnalyserRef.current = analyser;
    }

    let sourceNode = devDemoAudioSourceNodeRef.current;
    if (!sourceNode) {
      sourceNode = audioContext.createMediaElementSource(audio);
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
      devDemoAudioSourceNodeRef.current = sourceNode;
    }

    let buffers = devDemoAnalyserBuffersRef.current;
    if (!buffers) {
      buffers = createAudioFeatureBuffers(analyser.fftSize);
      devDemoAnalyserBuffersRef.current = buffers;
    }

    return { analyser, buffers };
  };

  const stopDevDemoPlayback = () => {
    stopDevDemoPreviewLoop();
    const audio = devDemoAudioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore media seek errors while source changes
      }
    }
    setDevDemoPlaying(false);
    setActiveDevDemoClipId(null);
    setDevDemoPlaybackError(null);
    settleVisualPreview(false);
  };

  const startDevDemoPreviewLoop = (params: {
    analyser: AnalyserNode;
    buffers: AudioFeatureBuffers;
  }) => {
    stopDevDemoPreviewLoop();

    const loop = () => {
      if (disposedRef.current) {
        return;
      }

      const previewAudio = devDemoAudioRef.current;
      if (!previewAudio) {
        return;
      }

      if (!previewAudio.paused) {
        const features = sampleAudioFeatures(params.analyser, params.buffers);
        const pseudoThresholdRms = 0.01;
        const gateActive = features.rms >= pseudoThresholdRms * 0.8;
        const intensity = Math.min(Math.max(features.rms / pseudoThresholdRms, 0), 3);
        applyAudioReactivePreview(features, gateActive, intensity);
      }

      devDemoPreviewRafRef.current = requestAnimationFrame(loop);
    };

    devDemoPreviewRafRef.current = requestAnimationFrame(loop);
  };

  const processAudioFrame = (timeMs: number, syntheticElapsedMs?: number) => {
    const gateState = gateStateRef.current;
    const gateMachine = gateMachineRef.current;
    const currentInputMode = inputModeRef.current;

    if (!gateState || !gateMachine || !currentInputMode) {
      return null;
    }

    let features: AudioFeatures;
    if (currentInputMode === "synthetic") {
      const source = syntheticAudioSourceRef.current;
      if (!source || typeof syntheticElapsedMs !== "number") {
        return null;
      }
      features = source.sampleFeatures(Math.max(0, syntheticElapsedMs));
    } else if (currentInputMode === "dev-demo-audio") {
      const analyser = devDemoAnalyserRef.current;
      const buffers = devDemoAnalyserBuffersRef.current;
      if (!analyser || !buffers) {
        return null;
      }
      features = sampleAudioFeatures(analyser, buffers);
    } else {
      const controller = micControllerRef.current;
      const buffers = featureBuffersRef.current;
      if (!controller || !buffers) {
        return null;
      }
      features = sampleAudioFeatures(controller.analyser, buffers);
    }

    const decision = stepEnergyGate(gateMachine, gateState, features.rms, timeMs);

    gateMachineRef.current = decision.machine;
    gateStateRef.current = decision.gate_state;

    if (timeMs - lastStoreAudioWriteAtRef.current >= 33) {
      lastStoreAudioWriteAtRef.current = timeMs;
      setAudioFeatures(features);
      setAudioGateState(decision.gate_state);
    }

    applyAudioReactivePreview(features, decision.machine.active, decision.intensity);

    return { features, decision };
  };

  const enterReady = () => {
    if (inputModeRef.current !== "dev-demo-audio") {
      stopDevDemoPlayback();
    } else {
      stopDevDemoPreviewLoop();
    }
    setAutoAdvanceInMs(null);
    const readyStartedAt = getNowMs();
    sessionStartedAtRef.current = readyStartedAt;
    resetPromptMachineRuntime(readyStartedAt);
    startReadyLoop();
  };

  const resetToPermission = () => {
    stopLoop();
    stopDevDemoPlayback();
    const controller = micControllerRef.current;
    micControllerRef.current = null;
    syntheticAudioSourceRef.current = null;
    inputModeRef.current = null;
    featureBuffersRef.current = null;
    gateStateRef.current = null;
    gateMachineRef.current = null;
    calibrationSamplesRef.current = [];
    autoAdvanceDeadlineRef.current = null;
    heardSignalAtRef.current = null;
    lastStoreAudioWriteAtRef.current = 0;
    setPermissionError(null);
    setCalibrationProgress(0);
    setPreviewStats(INITIAL_PREVIEW_STATS);
    setFeatureStats(INITIAL_FEATURE_STATS);
    setAutoAdvanceInMs(null);
    setInputMode(null);
    sessionStartedAtRef.current = 0;
    resetPromptMachineRuntime(0);
    setAudioFeatures({ ...EMPTY_AUDIO_FEATURES });
    setAudioGateState(null);
    resetVisualState();
    setPhase("permission");
    void controller?.dispose();
  };

  const startMicTestLoop = () => {
    stopLoop();
    const controller = micControllerRef.current;
    const gateState = gateStateRef.current;
    if (!gateState) {
      return;
    }

    if (inputModeRef.current === "mic" && !controller) {
      return;
    }

    gateMachineRef.current = createEnergyGateMachine(false, 0);
    micTestStartedAtRef.current = 0;
    heardSignalAtRef.current = null;
    lastUiStatsAtRef.current = 0;
    autoAdvanceDeadlineRef.current = null;
    setPreviewStats({
      rms: 0,
      noiseFloorRms: gateState.noise_floor_rms,
      thresholdRms: gateState.energy_threshold_rms,
      gateActive: false,
    });
    setAutoAdvanceInMs(5000);
    setPhase("mic-test");
    setFeatureStats(INITIAL_FEATURE_STATS);

    const loop = (timeMs: number) => {
      if (disposedRef.current) {
        return;
      }

      if (micTestStartedAtRef.current === 0) {
        micTestStartedAtRef.current = timeMs;
      }

      const frame = processAudioFrame(
        timeMs,
        Math.max(0, timeMs - micTestStartedAtRef.current),
      );
      if (!frame) {
        return;
      }
      const { features, decision } = frame;

      if (decision.opened && heardSignalAtRef.current === null) {
        heardSignalAtRef.current = timeMs;
        autoAdvanceDeadlineRef.current = timeMs + 1500;
      }

      if (heardSignalAtRef.current === null && timeMs - micTestStartedAtRef.current >= 5000) {
        autoAdvanceDeadlineRef.current = timeMs;
      }

      if (timeMs - lastUiStatsAtRef.current >= 80) {
        lastUiStatsAtRef.current = timeMs;
        setPreviewStats({
          rms: features.rms,
          noiseFloorRms: decision.gate_state.noise_floor_rms,
          thresholdRms: decision.gate_state.energy_threshold_rms,
          gateActive: decision.machine.active,
        });
        setFeatureStats({
          ...features,
          gateActive: decision.machine.active,
        });

        const deadline = autoAdvanceDeadlineRef.current;
        setAutoAdvanceInMs(deadline ? Math.max(0, deadline - timeMs) : null);
      }

      if (
        autoAdvanceDeadlineRef.current !== null &&
        timeMs >= autoAdvanceDeadlineRef.current
      ) {
        enterReady();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const startReadyLoop = () => {
    stopLoop();
    setPhase("ready");
    setAutoAdvanceInMs(null);
    lastUiStatsAtRef.current = 0;

    const loop = (timeMs: number) => {
      if (disposedRef.current) {
        return;
      }

      const frame = processAudioFrame(
        timeMs,
        sessionStartedAtRef.current > 0 ? Math.max(0, timeMs - sessionStartedAtRef.current) : 0,
      );
      if (!frame) {
        return;
      }

      const previousPromptState = promptMachineRef.current;
      const sessionElapsedS =
        sessionStartedAtRef.current > 0
          ? Math.max(0, (timeMs - sessionStartedAtRef.current) / 1000)
          : 0;
      const detectedPromptAudioEvent = detectPromptAudioEvent({
        current: frame.features,
        previous: previousAudioFeaturesForPromptRef.current,
        gate: frame.decision.gate_state,
      });
      previousAudioFeaturesForPromptRef.current = frame.features;

      const requestedPromptTrigger =
        detectedPromptAudioEvent ?? (sessionElapsedS >= 20 ? "time" : null);

      const promptTickResult = tickPromptMachine(
        previousPromptState,
        {
          now_ms: timeMs,
          session_elapsed_s: sessionElapsedS,
          hold_pointer_near_prompt: promptZoneHeldRef.current,
          requested_trigger: requestedPromptTrigger,
        },
        PROMPT_LIBRARY,
      );
      promptMachineRef.current = promptTickResult.state;

      const promptChanged =
        previousPromptState.lifecycle !== promptTickResult.state.lifecycle ||
        previousPromptState.active_prompt?.id !== promptTickResult.state.active_prompt?.id;
      handlePromptEvents(promptTickResult.events, timeMs);
      syncPromptUiState(promptTickResult.state, timeMs, promptChanged || promptTickResult.events.length > 0);

      if (timeMs - lastUiStatsAtRef.current >= 100) {
        lastUiStatsAtRef.current = timeMs;
        setFeatureStats({
          ...frame.features,
          gateActive: frame.decision.machine.active,
        });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const startCalibrationLoop = () => {
    stopLoop();
    calibrationSamplesRef.current = [];
    calibrationStartedAtRef.current = 0;
    setCalibrationProgress(0);
    setPhase("calibrating");
    settleVisualPreview(false);

    const loop = (timeMs: number) => {
      if (disposedRef.current) {
        return;
      }

      if (calibrationStartedAtRef.current === 0) {
        calibrationStartedAtRef.current = timeMs;
      }

      const elapsed = timeMs - calibrationStartedAtRef.current;
      const progress = computeCalibrationProgress(elapsed);
      let rms = 0;
      if (inputModeRef.current === "synthetic") {
        const source = syntheticAudioSourceRef.current;
        if (!source) {
          return;
        }
        rms = source.sampleCalibrationRms(elapsed);
      } else if (inputModeRef.current === "dev-demo-audio") {
        const analyser = devDemoAnalyserRef.current;
        const buffers = devDemoAnalyserBuffersRef.current;
        if (!analyser || !buffers) {
          return;
        }
        rms = sampleAudioFeatures(analyser, buffers).rms;
      } else {
        const liveController = micControllerRef.current;
        if (!liveController) {
          return;
        }
        rms = liveController.sampleRms();
      }
      calibrationSamplesRef.current.push(rms);
      setCalibrationProgress(progress);

      if (elapsed >= CALIBRATION_DURATION_MS) {
        gateStateRef.current = createAudioGateStateFromCalibration(
          calibrationSamplesRef.current,
          Date.now(),
        );
        startMicTestLoop();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const handleAllow = async () => {
    if (!supported || phase === "requesting") {
      return;
    }

    stopDevDemoPlayback();
    setPermissionError(null);
    setPhase("requesting");

    try {
      const existing = micControllerRef.current;
      micControllerRef.current = null;
      if (existing) {
        await existing.dispose();
      }

      const controller = await createMicInputController();
      if (disposedRef.current) {
        await controller.dispose();
        return;
      }

      micControllerRef.current = controller;
      syntheticAudioSourceRef.current = null;
      inputModeRef.current = "mic";
      setInputMode("mic");
      featureBuffersRef.current = createAudioFeatureBuffers(controller.analyser.fftSize);
      startCalibrationLoop();
    } catch (error) {
      setPermissionError(getMicErrorMessage(error));
      setPhase("permission");
    }
  };

  const handleSkipMicTest = () => {
    enterReady();
  };

  const handleContinueFromMicTest = () => {
    enterReady();
  };

  const handleUseDevBypass = () => {
    if (!devBypassEnabled || phase === "requesting") {
      return;
    }

    stopLoop();
    const controller = micControllerRef.current;
    micControllerRef.current = null;
    featureBuffersRef.current = null;
    void controller?.dispose();

    setPermissionError(null);
    const canUsePlayingDemoClip =
      activeDevDemoClipId !== null &&
      devDemoPlaying &&
      devDemoAudioRef.current !== null &&
      devDemoAnalyserRef.current !== null &&
      devDemoAnalyserBuffersRef.current !== null;

    if (canUsePlayingDemoClip) {
      stopDevDemoPreviewLoop();
      syntheticAudioSourceRef.current = null;
      inputModeRef.current = "dev-demo-audio";
      setInputMode("dev-demo-audio");
      startCalibrationLoop();
      return;
    }

    stopDevDemoPlayback();
    syntheticAudioSourceRef.current = createSyntheticAudioSource();
    inputModeRef.current = "synthetic";
    setInputMode("synthetic");
    startCalibrationLoop();
  };

  const handleToggleDevDemoClip = async (clipId: string) => {
    if (!devBypassEnabled) {
      return;
    }

    const audio = devDemoAudioRef.current;
    const clip = getDevDemoAudioClipById(clipId);
    if (!audio || !clip) {
      return;
    }

    setDevDemoPlaybackError(null);

    if (activeDevDemoClipId === clipId && !audio.paused) {
      audio.pause();
      stopDevDemoPreviewLoop();
      settleVisualPreview(false);
      return;
    }

    try {
      if (activeDevDemoClipId !== clipId) {
        audio.src = clip.href;
        audio.load();
      }

      const analyserControls = await ensureDevDemoAudioAnalyser();
      setActiveDevDemoClipId(clip.id);
      await audio.play();
      startDevDemoPreviewLoop(analyserControls);
    } catch (error) {
      setDevDemoPlaybackError(
        error instanceof Error ? error.message : "Could not play demo clip.",
      );
    }
  };

  const handlePromptChipSelect = (chipId: string, chipLabel: string) => {
    const nowMs = getNowMs();
    const currentPromptState = promptMachineRef.current;
    const activePrompt = currentPromptState.active_prompt;
    if (!activePrompt) {
      return;
    }

    const promptDefinition = PROMPT_DEFINITION_BY_ID[activePrompt.definition_id];
    const chipDelta = promptDefinition?.chip_delta_map?.[chipId];
    if (chipDelta) {
      applyDelta(chipDelta);
    }

    const responseResult = respondToPrompt(currentPromptState, {
      now_ms: nowMs,
      chip_id: chipId,
      chip_label: chipLabel,
    });
    promptMachineRef.current = responseResult.state;
    handlePromptEvents(responseResult.events, nowMs);
    syncPromptUiState(responseResult.state, nowMs, true);

    promptZoneHeldRef.current = false;
    setPromptZoneHeld(false);
  };

  const handlePromptZoneHoldChange = (held: boolean) => {
    promptZoneHeldRef.current = held;
    setPromptZoneHeld(held);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#070510] text-white">
      <div className="absolute inset-0">
        <SessionCanvas className="h-full w-full" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(100,115,255,0.12),transparent_58%)]" />

      <div className="relative z-10 flex h-full items-center justify-center px-4 py-8">
        {phase === "permission" || phase === "requesting" ? (
          <MicPermissionScreen
            supported={supported}
            requesting={phase === "requesting"}
            errorMessage={permissionError}
            onAllow={handleAllow}
            showDevBypass={devBypassEnabled}
            onUseDevBypass={handleUseDevBypass}
            activeDevDemoClipId={activeDevDemoClipId}
            devDemoPlaying={devDemoPlaying}
            onToggleDevDemoClip={handleToggleDevDemoClip}
            devDemoPlaybackError={devDemoPlaybackError}
          />
        ) : null}

        {phase === "calibrating" ? (
          <MicCalibrationScreen progress={calibrationProgress} />
        ) : null}

        {phase === "mic-test" ? (
          <MicTestScreen
            rms={previewStats.rms}
            noiseFloorRms={previewStats.noiseFloorRms}
            thresholdRms={previewStats.thresholdRms}
            gateActive={previewStats.gateActive}
            autoAdvanceInMs={autoAdvanceInMs}
            onContinue={handleContinueFromMicTest}
            onSkip={handleSkipMicTest}
          />
        ) : null}

        {phase === "ready" ? (
          <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-6 text-center backdrop-blur">
            <p className="text-xs tracking-[0.22em] text-white/45 uppercase">Qualia</p>
            <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
              mic is ready
            </h2>
            <p className="mt-2 text-sm text-white/70 sm:text-base">
              prompts now drift in with deterministic chip responses while the mic drives the field.
            </p>
            <p className="mt-3 text-xs text-white/50">
              Mood bar and session recording are next. Chip taps update visuals instantly and dismiss the prompt.
            </p>
            {inputMode === "synthetic" ? (
              <p className="mt-2 text-xs text-cyan-100/75">
                Dev demo input is active (deterministic synthetic audio).
              </p>
            ) : null}
            {inputMode === "dev-demo-audio" ? (
              <p className="mt-2 text-xs text-cyan-100/75">
                Dev demo clip input is active (live analysed audio from the playing clip).
              </p>
            ) : null}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-left">
              <div className="mb-3 flex items-center justify-between text-xs text-white/55">
                <span className="uppercase tracking-[0.18em]">live audio features</span>
                <span
                  className={
                    featureStats.gateActive ? "text-emerald-200" : "text-white/45"
                  }
                >
                  {featureStats.gateActive ? "gate open" : "gate idle"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-white/70 sm:grid-cols-3">
                <div>rms: {featureStats.rms.toFixed(4)}</div>
                <div>bass: {featureStats.bass_energy.toFixed(3)}</div>
                <div>mid: {featureStats.mid_energy.toFixed(3)}</div>
                <div>high: {featureStats.high_energy.toFixed(3)}</div>
                <div>centroid: {featureStats.spectral_centroid.toFixed(3)}</div>
                <div>zcr: {featureStats.zero_crossing_rate.toFixed(3)}</div>
              </div>
            </div>
            {lastPromptResponse ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left text-xs text-white/65">
                <div className="uppercase tracking-[0.18em] text-white/45">last prompt</div>
                <div className="mt-1 truncate text-white/80">{lastPromptResponse.promptText}</div>
                <div className="mt-1">
                  <span className="text-white/50">chip:</span> {lastPromptResponse.chipLabel}
                  <span className="mx-2 text-white/25">•</span>
                  <span className="text-white/50">latency:</span>{" "}
                  {Math.round(lastPromptResponse.responseLatencyMs)}ms
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={resetToPermission}
              className="mt-5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition hover:border-white/35 hover:bg-white/16"
            >
              test mic again
            </button>
          </div>
        ) : null}
      </div>

      {phase === "ready" ? (
        <PromptOverlay
          prompt={promptMachineState.active_prompt}
          lifecycle={promptMachineState.lifecycle}
          holdTimer={promptZoneHeld}
          onChipSelect={handlePromptChipSelect}
          onPromptZoneHoldChange={handlePromptZoneHoldChange}
        />
      ) : null}

      {phase === "ready" ? <MoodBar /> : null}

      <audio ref={devDemoAudioRef} preload="none" className="hidden" />
    </div>
  );
}
