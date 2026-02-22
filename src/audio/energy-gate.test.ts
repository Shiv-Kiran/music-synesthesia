import { describe, expect, it } from "vitest";

import { createEnergyGateMachine, stepEnergyGate } from "@/audio/energy-gate";
import type { AudioGateState } from "@/contracts/audio";

const gateState: AudioGateState = {
  noise_floor_rms: 0.01,
  energy_threshold_rms: 0.02,
  gated_active: false,
  calibrated_at: 100,
};

describe("energy gate", () => {
  it("opens when RMS crosses open threshold", () => {
    const result = stepEnergyGate(
      createEnergyGateMachine(false, 0),
      gateState,
      0.025,
      500,
    );

    expect(result.opened).toBe(true);
    expect(result.closed).toBe(false);
    expect(result.machine.active).toBe(true);
    expect(result.gate_state.gated_active).toBe(true);
  });

  it("holds active until close threshold and minimum hold time are met", () => {
    const opened = stepEnergyGate(
      createEnergyGateMachine(false, 0),
      gateState,
      0.03,
      1000,
    );
    const earlyDrop = stepEnergyGate(opened.machine, opened.gate_state, 0.001, 1100, {
      minHoldMs: 300,
    });
    const lateDrop = stepEnergyGate(earlyDrop.machine, earlyDrop.gate_state, 0.001, 1400, {
      minHoldMs: 300,
    });

    expect(earlyDrop.machine.active).toBe(true);
    expect(earlyDrop.closed).toBe(false);
    expect(lateDrop.machine.active).toBe(false);
    expect(lateDrop.closed).toBe(true);
  });

  it("returns normalized intensity relative to the open threshold", () => {
    const result = stepEnergyGate(
      createEnergyGateMachine(false, 0),
      gateState,
      0.04,
      700,
    );

    expect(result.intensity).toBeGreaterThan(1);
    expect(result.intensity).toBeLessThanOrEqual(4);
  });
});

