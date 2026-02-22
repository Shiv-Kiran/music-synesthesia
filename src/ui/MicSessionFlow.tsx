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
import { createMicInputController, isMicSupported, type MicInputController } from "@/audio/mic";
import type { AudioGateState } from "@/contracts/audio";
import { useQualiaStore } from "@/state/qualia-store";
import { MicCalibrationScreen } from "@/ui/MicCalibrationScreen";
import { MicPermissionScreen } from "@/ui/MicPermissionScreen";
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

const INITIAL_PREVIEW_STATS: MicPreviewStats = {
  rms: 0,
  noiseFloorRms: 0,
  thresholdRms: 0,
  gateActive: false,
};

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

export function MicSessionFlow() {
  const resetVisualState = useQualiaStore((state) => state.resetVisualState);
  const applyDelta = useQualiaStore((state) => state.applyDelta);

  const [phase, setPhase] = useState<MicFlowPhase>("permission");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [previewStats, setPreviewStats] = useState<MicPreviewStats>(INITIAL_PREVIEW_STATS);
  const [autoAdvanceInMs, setAutoAdvanceInMs] = useState<number | null>(null);

  const micControllerRef = useRef<MicInputController | null>(null);
  const gateStateRef = useRef<AudioGateState | null>(null);
  const gateMachineRef = useRef<EnergyGateMachine | null>(null);
  const rafRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<number[]>([]);
  const calibrationStartedAtRef = useRef<number>(0);
  const micTestStartedAtRef = useRef<number>(0);
  const heardSignalAtRef = useRef<number | null>(null);
  const lastUiStatsAtRef = useRef<number>(0);
  const autoAdvanceDeadlineRef = useRef<number | null>(null);
  const disposedRef = useRef(false);

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
      void controller?.dispose();
    };
  }, [resetVisualState]);

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

  const enterReady = () => {
    stopLoop();
    setAutoAdvanceInMs(null);
    setPhase("ready");
    settleVisualPreview(false);
  };

  const resetToPermission = () => {
    stopLoop();
    const controller = micControllerRef.current;
    micControllerRef.current = null;
    gateStateRef.current = null;
    gateMachineRef.current = null;
    calibrationSamplesRef.current = [];
    autoAdvanceDeadlineRef.current = null;
    heardSignalAtRef.current = null;
    setPermissionError(null);
    setCalibrationProgress(0);
    setPreviewStats(INITIAL_PREVIEW_STATS);
    setAutoAdvanceInMs(null);
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

    gateMachineRef.current = createEnergyGateMachine(false, performance.now());
    micTestStartedAtRef.current = performance.now();
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

    const loop = (timeMs: number) => {
      if (disposedRef.current) {
        return;
      }

      const activeController = micControllerRef.current;
      const activeGateState = gateStateRef.current;
      const activeMachine = gateMachineRef.current;
      if (!activeController || !activeGateState || !activeMachine) {
        return;
      }

      const rms = activeController.sampleRms();
      const decision = stepEnergyGate(activeMachine, activeGateState, rms, timeMs);
      gateMachineRef.current = decision.machine;
      gateStateRef.current = decision.gate_state;

      if (decision.opened && heardSignalAtRef.current === null) {
        heardSignalAtRef.current = timeMs;
        autoAdvanceDeadlineRef.current = timeMs + 1500;
      }

      if (heardSignalAtRef.current === null && timeMs - micTestStartedAtRef.current >= 5000) {
        autoAdvanceDeadlineRef.current = timeMs;
      }

      settleVisualPreview(decision.machine.active, decision.intensity);

      if (timeMs - lastUiStatsAtRef.current >= 80) {
        lastUiStatsAtRef.current = timeMs;
        setPreviewStats({
          rms: decision.rms,
          noiseFloorRms: decision.gate_state.noise_floor_rms,
          thresholdRms: decision.gate_state.energy_threshold_rms,
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

  const startCalibrationLoop = () => {
    stopLoop();
    calibrationSamplesRef.current = [];
    calibrationStartedAtRef.current = performance.now();
    setCalibrationProgress(0);
    setPhase("calibrating");
    settleVisualPreview(false);

    const loop = (timeMs: number) => {
      if (disposedRef.current) {
        return;
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
              PR-04 complete: permission, calibration, energy gate, and mic test are working.
            </p>
            <p className="mt-3 text-xs text-white/50">
              Next PRs will add prompt flow, mood bar, and session recording on this screen.
            </p>
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
    </div>
  );
}
