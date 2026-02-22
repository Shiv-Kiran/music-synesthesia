import type { VisualStateDelta } from "@/contracts/visual-state";

export type PromptPhase =
  | "grounding"
  | "temperature"
  | "texture"
  | "space"
  | "taste"
  | "narrative"
  | "free-word";

export type PromptTriggerHintEvent =
  | "time"
  | "energy_spike"
  | "drop"
  | "bpm_shift";

export interface PromptChip {
  id: string;
  label: string;
}

export interface PromptDefinition {
  id: string;
  phase: PromptPhase;
  variants: string[];
  chips: PromptChip[];
  chip_delta_map: Record<string, VisualStateDelta>;
  oddball_seed?: {
    enabled: boolean;
    chip_id?: string;
    chance: number;
  };
  trigger_hints?: {
    min_t?: number;
    max_freq_s?: number;
    event_type?: PromptTriggerHintEvent[];
  };
}

