"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CALIBRATION_DURATION_MS,
  computeCalibrationProgress,
  createAudioGateStateFromCalibration,
} from "@/audio/calibrate";
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
  const [promptMachineState, setPromptMachineState] = useState<PromptMachineState>(() =>
    createPromptMachineState(0),
  );
  const [promptZoneHeld, setPromptZoneHeld] = useState(false);
  const [lastPromptResponse, setLastPromptResponse] = useState<PromptResponseDebug | null>(null);

  const micControllerRef = useRef<MicInputController | null>(null);
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

  const supported = useMemo(() => isMicSupported(), []);

  function stopLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  useEffect(() => {
    resetVisualState();
    return () => {
      disposedRef.current = true;
      stopLoop();
      const controller = micControllerRef.current;
      micControllerRef.current = null;
      featureBuffersRef.current = null;
      setAudioFeatures({ ...EMPTY_AUDIO_FEATURES });
      setAudioGateState(null);
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

  const settleVisualPreview = (active: boolean, intensity = 0) => {
    if (active) {
      const clamped = Math.min(Math.max(intensity, 0), 3);
      applyDelta({
        set: {
          pulse_strength: Math.min(0.2 + clamped * 0.28, 1),
          turbulence: Math.min(0.18 + clamped * 0.16, 1),
          brightness: Math.min(0.22 + clamped * 0.08, 0.75),
          hue_chaos: Math.min(0.1 + clamped * 0.12, 1),
          particle_density: Math.min(0.25 + clamped * 0.14, 1),
          wave_speed: Math.min(0.35 + clamped * 0.22, 2),
        },
        lerp_ms: 90,
        source: "audio",
      });
      return;
    }

    applyDelta({
      set: {
        pulse_strength: 0.22,
        turbulence: 0.2,
        brightness: 0.26,
        hue_chaos: 0.12,
        particle_density: 0.3,
        wave_speed: 0.35,
      },
      lerp_ms: 220,
      source: "audio",
    });
  };

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

    const intensityBias = Math.min(Math.max(intensity, 0), 3);
    applyDelta({
      set: {
        pulse_strength: clamp01(
          0.12 + features.bass_energy * 0.58 + features.rms * 2.2 + intensityBias * 0.05,
        ),
        turbulence: clamp01(
          0.1 + features.high_energy * 0.48 + features.zero_crossing_rate * 0.65,
        ),
        brightness: clamp01(
          0.16 +
            features.rms * 1.9 +
            features.spectral_centroid * 0.16 +
            intensityBias * 0.03,
        ),
        hue_chaos: clamp01(
          0.06 + features.high_energy * 0.34 + features.zero_crossing_rate * 0.3,
        ),
        particle_density: clamp01(
          0.18 + features.mid_energy * 0.32 + features.high_energy * 0.22,
        ),
        wave_speed: clampWaveSpeed(
          0.2 + features.bass_energy * 0.7 + features.mid_energy * 0.45,
        ),
        blur: clamp01(0.03 + (1 - features.spectral_centroid) * 0.1),
      },
      lerp_ms: 80,
      source: "audio",
    });
  };

  const processAudioFrame = (timeMs: number) => {
    const controller = micControllerRef.current;
    const buffers = featureBuffersRef.current;
    const gateState = gateStateRef.current;
    const gateMachine = gateMachineRef.current;

    if (!controller || !buffers || !gateState || !gateMachine) {
      return null;
    }

    const features = sampleAudioFeatures(controller.analyser, buffers);
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
    setAutoAdvanceInMs(null);
    const readyStartedAt = getNowMs();
    sessionStartedAtRef.current = readyStartedAt;
    resetPromptMachineRuntime(readyStartedAt);
    startReadyLoop();
  };

  const resetToPermission = () => {
    stopLoop();
    const controller = micControllerRef.current;
    micControllerRef.current = null;
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
    if (!controller || !gateState) {
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

      const frame = processAudioFrame(timeMs);
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

      const frame = processAudioFrame(timeMs);
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

      const controller = micControllerRef.current;
      if (!controller) {
        return;
      }

      const elapsed = timeMs - calibrationStartedAtRef.current;
      const progress = computeCalibrationProgress(elapsed);
      const rms = controller.sampleRms();
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
    </div>
  );
}
