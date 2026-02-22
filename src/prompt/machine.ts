import type { PromptDefinition } from "@/contracts/prompt";
import type { SnapshotTrigger } from "@/contracts/session";
import { selectPromptDefinition } from "@/prompt/phase-selection";
import type {
  PromptInstance,
  PromptMachineEvent,
  PromptMachineRespondedEvent,
  PromptMachineState,
  PromptMachineTickInput,
  PromptMachineTickResult,
} from "@/prompt/prompt-types";

export const PROMPT_APPEAR_MS = 600;
export const PROMPT_SOFT_FADE_START_MS = 15_000;
export const PROMPT_TIMER_DOT_MS = 25_000;
export const PROMPT_DISMISS_START_MS = 30_000;
export const PROMPT_REMOVE_MS = 35_000;
export const PROMPT_GLOBAL_COOLDOWN_MS = 20_000;
export const PROMPT_TYPING_HOLD_MS = 8_000;

function deriveLifecycleForElapsed(elapsedVisibleMs: number): PromptMachineState["lifecycle"] {
  if (elapsedVisibleMs < PROMPT_APPEAR_MS) {
    return "appearing";
  }
  if (elapsedVisibleMs < PROMPT_SOFT_FADE_START_MS) {
    return "visible";
  }
  if (elapsedVisibleMs < PROMPT_REMOVE_MS) {
    return "fading";
  }
  return "gone";
}

function shouldHoldPromptTimer(input: PromptMachineTickInput): boolean {
  if (input.hold_pointer_near_prompt) {
    return true;
  }

  if (typeof input.last_typing_activity_ms === "number") {
    return input.now_ms - input.last_typing_activity_ms < PROMPT_TYPING_HOLD_MS;
  }

  return false;
}

function buildPromptInstance(
  definition: PromptDefinition,
  trigger: Extract<SnapshotTrigger, "time" | "energy_spike" | "drop" | "bpm_shift">,
  nowMs: number,
  variantIndex: number,
): PromptInstance {
  const normalizedVariantIndex =
    definition.variants.length > 0 ? variantIndex % definition.variants.length : 0;
  const text = definition.variants[normalizedVariantIndex] ?? "";
  const instanceId = `${definition.id}:${nowMs}`;

  return {
    id: instanceId,
    definition_id: definition.id,
    phase: definition.phase,
    text,
    chips: definition.chips,
    trigger,
    shown_at_ms: nowMs,
    elapsed_visible_ms: 0,
  };
}

export function createPromptMachineState(sessionStartedAtMs = 0): PromptMachineState {
  return {
    lifecycle: "idle",
    active_prompt: null,
    session_started_at_ms: sessionStartedAtMs,
    last_tick_ms: null,
    last_prompt_started_at_ms: null,
    last_prompt_ended_at_ms: null,
    shown_count_by_definition: {},
    next_variant_index_by_definition: {},
    response_count: 0,
  };
}

function canStartPrompt(
  state: PromptMachineState,
  nowMs: number,
): boolean {
  if (state.active_prompt) {
    return false;
  }

  if (state.last_prompt_started_at_ms === null) {
    return true;
  }

  return nowMs - state.last_prompt_started_at_ms >= PROMPT_GLOBAL_COOLDOWN_MS;
}

export function tickPromptMachine(
  state: PromptMachineState,
  input: PromptMachineTickInput,
  definitions: PromptDefinition[],
): PromptMachineTickResult {
  const events: PromptMachineEvent[] = [];

  let nextState: PromptMachineState = {
    ...state,
    shown_count_by_definition: { ...state.shown_count_by_definition },
    next_variant_index_by_definition: { ...state.next_variant_index_by_definition },
  };

  const lastTickMs = nextState.last_tick_ms ?? input.now_ms;
  const dtMs = Math.max(0, input.now_ms - lastTickMs);
  nextState.last_tick_ms = input.now_ms;

  if (nextState.active_prompt) {
    const holdTimer = shouldHoldPromptTimer(input);
    const elapsedDelta = holdTimer ? 0 : dtMs;
    const activePrompt = {
      ...nextState.active_prompt,
      elapsed_visible_ms: nextState.active_prompt.elapsed_visible_ms + elapsedDelta,
    };

    const lifecycle = deriveLifecycleForElapsed(activePrompt.elapsed_visible_ms);
    if (lifecycle === "gone") {
      nextState = {
        ...nextState,
        lifecycle: "idle",
        active_prompt: null,
        last_prompt_ended_at_ms: input.now_ms,
      };
      events.push({
        type: "prompt_dismissed",
        prompt: activePrompt,
        reason: "timeout",
      });
    } else {
      nextState = {
        ...nextState,
        lifecycle,
        active_prompt: activePrompt,
      };
    }
  }

  const trigger = input.requested_trigger ?? null;
  if (!trigger || !canStartPrompt(nextState, input.now_ms)) {
    return {
      state: nextState,
      events,
    };
  }

  const definition = selectPromptDefinition(definitions, nextState, {
    trigger,
    now_ms: input.now_ms,
    session_elapsed_s: input.session_elapsed_s,
  });

  if (!definition || definition.variants.length === 0 || definition.chips.length === 0) {
    return {
      state: nextState,
      events,
    };
  }

  const variantIndex = nextState.next_variant_index_by_definition[definition.id] ?? 0;
  const prompt = buildPromptInstance(definition, trigger, input.now_ms, variantIndex);

  nextState.next_variant_index_by_definition[definition.id] = variantIndex + 1;
  nextState.shown_count_by_definition[definition.id] =
    (nextState.shown_count_by_definition[definition.id] ?? 0) + 1;
  nextState.active_prompt = prompt;
  nextState.last_prompt_started_at_ms = input.now_ms;
  nextState.lifecycle = deriveLifecycleForElapsed(prompt.elapsed_visible_ms);

  events.push({
    type: "prompt_shown",
    prompt,
    definition,
  });

  return {
    state: nextState,
    events,
  };
}

export function respondToPrompt(
  state: PromptMachineState,
  params: {
    now_ms: number;
    chip_id: string;
    chip_label: string;
  },
): { state: PromptMachineState; events: PromptMachineEvent[] } {
  if (!state.active_prompt) {
    return { state, events: [] };
  }

  const responseLatencyMs = Math.max(0, params.now_ms - state.active_prompt.shown_at_ms);
  const respondedEvent: PromptMachineRespondedEvent = {
    type: "prompt_responded",
    prompt: state.active_prompt,
    chip_id: params.chip_id,
    chip_label: params.chip_label,
    response_latency_ms: responseLatencyMs,
  };

  const dismissedEvent: PromptMachineEvent = {
    type: "prompt_dismissed",
    prompt: state.active_prompt,
    reason: "responded",
  };

  return {
    state: {
      ...state,
      lifecycle: "idle",
      active_prompt: null,
      last_tick_ms: params.now_ms,
      last_prompt_ended_at_ms: params.now_ms,
      response_count: state.response_count + 1,
    },
    events: [respondedEvent, dismissedEvent],
  };
}

export function getPromptUiMeta(state: PromptMachineState): {
  timer_dot_visible: boolean;
  dismiss_started: boolean;
  soft_fade_started: boolean;
  hold_timer: boolean;
} {
  const prompt = state.active_prompt;
  const elapsed = prompt?.elapsed_visible_ms ?? 0;
  return {
    timer_dot_visible: elapsed >= PROMPT_TIMER_DOT_MS,
    dismiss_started: elapsed >= PROMPT_DISMISS_START_MS,
    soft_fade_started: elapsed >= PROMPT_SOFT_FADE_START_MS,
    hold_timer: false,
  };
}

