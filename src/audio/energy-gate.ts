import type { AudioGateState } from "@/contracts/audio";

export const DEFAULT_GATE_CLOSE_RATIO = 0.82;
export const DEFAULT_GATE_MIN_HOLD_MS = 220;

export interface EnergyGateThresholds {
  open_rms: number;
  close_rms: number;
}

export interface EnergyGateMachine {
  active: boolean;
  last_toggle_at: number;
}

export interface EnergyGateDecision {
  machine: EnergyGateMachine;
  gate_state: AudioGateState;
  thresholds: EnergyGateThresholds;
  opened: boolean;
  closed: boolean;
  rms: number;
  intensity: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getEnergyGateThresholds(
  gate: AudioGateState,
  closeRatio = DEFAULT_GATE_CLOSE_RATIO,
): EnergyGateThresholds {
  const open_rms = Math.max(0, gate.energy_threshold_rms || 0);
  const ratio = clamp(closeRatio, 0.05, 0.99);
  const close_rms = Math.max(0, open_rms * ratio);
  return { open_rms, close_rms };
}

export function createEnergyGateMachine(
  active = false,
  timestampMs = 0,
): EnergyGateMachine {
  return {
    active,
    last_toggle_at: timestampMs,
  };
}

export function stepEnergyGate(
  machine: EnergyGateMachine,
  gateState: AudioGateState,
  rms: number,
  nowMs: number,
  options?: {
    closeRatio?: number;
    minHoldMs?: number;
  },
): EnergyGateDecision {
  const thresholds = getEnergyGateThresholds(
    gateState,
    options?.closeRatio ?? DEFAULT_GATE_CLOSE_RATIO,
  );
  const minHoldMs = Math.max(0, options?.minHoldMs ?? DEFAULT_GATE_MIN_HOLD_MS);
  const safeRms = Number.isFinite(rms) ? Math.max(0, rms) : 0;

  let nextActive = machine.active;
  let opened = false;
  let closed = false;

  if (!machine.active) {
    if (safeRms >= thresholds.open_rms) {
      nextActive = true;
      opened = true;
    }
  } else {
    const heldLongEnough = nowMs - machine.last_toggle_at >= minHoldMs;
    if (heldLongEnough && safeRms <= thresholds.close_rms) {
      nextActive = false;
      closed = true;
    }
  }

  const nextMachine: EnergyGateMachine =
    nextActive !== machine.active
      ? { active: nextActive, last_toggle_at: nowMs }
      : machine;

  const nextGateState: AudioGateState = {
    ...gateState,
    gated_active: nextActive,
  };

  const denominator = Math.max(thresholds.open_rms, 0.000001);
  const intensity = clamp(safeRms / denominator, 0, 4);

  return {
    machine: nextMachine,
    gate_state: nextGateState,
    thresholds,
    opened,
    closed,
    rms: safeRms,
    intensity,
  };
}

