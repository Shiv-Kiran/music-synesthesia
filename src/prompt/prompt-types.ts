import type { AudioFeatures, AudioGateState } from "@/contracts/audio";
import type { PromptChip, PromptDefinition, PromptPhase } from "@/contracts/prompt";
import type { SnapshotTrigger } from "@/contracts/session";

export type PromptLifecycleState =
  | "idle"
  | "appearing"
  | "visible"
  | "fading"
  | "gone";

export interface PromptInstance {
  id: string;
  definition_id: string;
  phase: PromptPhase;
  text: string;
  chips: PromptChip[];
  trigger: Extract<SnapshotTrigger, "time" | "energy_spike" | "drop" | "bpm_shift">;
  shown_at_ms: number;
  elapsed_visible_ms: number;
}

export interface PromptMachineState {
  lifecycle: PromptLifecycleState;
  active_prompt: PromptInstance | null;
  session_started_at_ms: number;
  last_tick_ms: number | null;
  last_prompt_started_at_ms: number | null;
  last_prompt_ended_at_ms: number | null;
  shown_count_by_definition: Record<string, number>;
  next_variant_index_by_definition: Record<string, number>;
  response_count: number;
}

export interface PromptMachineTickInput {
  now_ms: number;
  session_elapsed_s: number;
  hold_pointer_near_prompt?: boolean;
  last_typing_activity_ms?: number | null;
  force_start?: boolean;
  requested_trigger?: Extract<
    SnapshotTrigger,
    "time" | "energy_spike" | "drop" | "bpm_shift"
  > | null;
}

export interface PromptMachineShownEvent {
  type: "prompt_shown";
  prompt: PromptInstance;
  definition: PromptDefinition;
}

export interface PromptMachineDismissedEvent {
  type: "prompt_dismissed";
  prompt: PromptInstance;
  reason: "timeout" | "responded";
}

export interface PromptMachineRespondedEvent {
  type: "prompt_responded";
  prompt: PromptInstance;
  chip_id: string;
  chip_label: string;
  response_latency_ms: number;
}

export type PromptMachineEvent =
  | PromptMachineShownEvent
  | PromptMachineDismissedEvent
  | PromptMachineRespondedEvent;

export interface PromptMachineTickResult {
  state: PromptMachineState;
  events: PromptMachineEvent[];
}

export interface PromptAudioContext {
  current: AudioFeatures;
  previous: AudioFeatures | null;
  gate: AudioGateState | null;
}
