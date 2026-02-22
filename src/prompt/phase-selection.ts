import type { PromptDefinition } from "@/contracts/prompt";
import type { SnapshotTrigger } from "@/contracts/session";
import type { PromptMachineState } from "@/prompt/prompt-types";

export interface PromptSelectionInput {
  trigger: Extract<SnapshotTrigger, "time" | "energy_spike" | "drop" | "bpm_shift">;
  now_ms: number;
  session_elapsed_s: number;
}

function definitionSupportsTrigger(
  definition: PromptDefinition,
  trigger: PromptSelectionInput["trigger"],
): boolean {
  const eventTypes = definition.trigger_hints?.event_type;
  if (!eventTypes || eventTypes.length === 0) {
    return true;
  }

  return eventTypes.includes(trigger);
}

function definitionMinTimeSatisfied(
  definition: PromptDefinition,
  sessionElapsedS: number,
): boolean {
  const minT = definition.trigger_hints?.min_t;
  return typeof minT !== "number" ? true : sessionElapsedS >= minT;
}

function definitionFrequencySatisfied(
  definition: PromptDefinition,
  state: PromptMachineState,
  nowMs: number,
): boolean {
  const maxFreqS = definition.trigger_hints?.max_freq_s;
  const lastShownCount = state.shown_count_by_definition[definition.id] ?? 0;
  if (!lastShownCount) {
    return true;
  }

  if (typeof maxFreqS !== "number") {
    return true;
  }

  const lastPromptStart = state.last_prompt_started_at_ms;
  if (lastPromptStart === null) {
    return true;
  }

  return nowMs - lastPromptStart >= maxFreqS * 1000;
}

export function selectPromptDefinition(
  definitions: PromptDefinition[],
  state: PromptMachineState,
  input: PromptSelectionInput,
): PromptDefinition | null {
  const eligible = definitions.filter((definition) => {
    return (
      definitionMinTimeSatisfied(definition, input.session_elapsed_s) &&
      definitionSupportsTrigger(definition, input.trigger) &&
      definitionFrequencySatisfied(definition, state, input.now_ms)
    );
  });

  if (eligible.length === 0) {
    return null;
  }

  // Deterministic preference:
  // 1) prompts shown fewer times in this session
  // 2) earlier `min_t`
  // 3) library order
  const ranked = [...eligible].sort((a, b) => {
    const shownA = state.shown_count_by_definition[a.id] ?? 0;
    const shownB = state.shown_count_by_definition[b.id] ?? 0;
    if (shownA !== shownB) {
      return shownA - shownB;
    }

    const minA = a.trigger_hints?.min_t ?? 0;
    const minB = b.trigger_hints?.min_t ?? 0;
    if (minA !== minB) {
      return minA - minB;
    }

    return definitions.indexOf(a) - definitions.indexOf(b);
  });

  return ranked[0] ?? null;
}

