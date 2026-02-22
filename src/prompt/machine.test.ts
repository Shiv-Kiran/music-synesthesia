import { describe, expect, it } from "vitest";

import { PROMPT_LIBRARY } from "@/content/prompts";
import {
  PROMPT_DISMISS_START_MS,
  PROMPT_GLOBAL_COOLDOWN_MS,
  PROMPT_REMOVE_MS,
  PROMPT_SOFT_FADE_START_MS,
  PROMPT_TIMER_DOT_MS,
  createPromptMachineState,
  respondToPrompt,
  tickPromptMachine,
} from "@/prompt/machine";

describe("prompt machine", () => {
  it("does not emit a prompt before min_t windows are satisfied", () => {
    const state = createPromptMachineState(0);
    const result = tickPromptMachine(
      state,
      {
        now_ms: 5_000,
        session_elapsed_s: 5,
        requested_trigger: "time",
      },
      PROMPT_LIBRARY,
    );

    expect(result.events).toHaveLength(0);
    expect(result.state.active_prompt).toBeNull();
  });

  it("shows a deterministic prompt and rotates variants without repeats", () => {
    let state = createPromptMachineState(0);

    const first = tickPromptMachine(
      state,
      { now_ms: 20_000, session_elapsed_s: 20, requested_trigger: "time" },
      PROMPT_LIBRARY,
    );
    state = first.state;
    const shown1 = first.events.find((e) => e.type === "prompt_shown");
    expect(shown1?.type).toBe("prompt_shown");
    expect(shown1?.prompt.phase).toBe("grounding");
    const firstText = shown1?.prompt.text;

    const responded = respondToPrompt(state, {
      now_ms: 21_000,
      chip_id: shown1?.prompt.chips[0]?.id ?? "deep",
      chip_label: shown1?.prompt.chips[0]?.label ?? "somewhere deep",
    });
    state = responded.state;

    // Cooldown blocks prompt
    const blocked = tickPromptMachine(
      state,
      {
        now_ms: 21_000 + PROMPT_GLOBAL_COOLDOWN_MS - 1,
        session_elapsed_s: 40,
        requested_trigger: "time",
      },
      PROMPT_LIBRARY,
    );
    expect(blocked.events.some((e) => e.type === "prompt_shown")).toBe(false);

    const second = tickPromptMachine(
      blocked.state,
      {
        now_ms: 21_000 + PROMPT_GLOBAL_COOLDOWN_MS + 1,
        session_elapsed_s: 90,
        requested_trigger: "time",
      },
      PROMPT_LIBRARY,
    );
    const shown2 = second.events.find((e) => e.type === "prompt_shown");
    expect(shown2?.type).toBe("prompt_shown");
    expect(shown2?.prompt.text).not.toBe(firstText);
  });

  it("advances lifecycle timing and times out by 35s without interaction", () => {
    let state = createPromptMachineState(0);
    state = tickPromptMachine(
      state,
      {
        now_ms: 20_000,
        session_elapsed_s: 20,
        requested_trigger: "time",
      },
      PROMPT_LIBRARY,
    ).state;
    expect(state.lifecycle).toBe("appearing");

    state = tickPromptMachine(
      state,
      { now_ms: 20_800, session_elapsed_s: 20.8 },
      PROMPT_LIBRARY,
    ).state;
    expect(state.lifecycle).toBe("visible");
    expect((state.active_prompt?.elapsed_visible_ms ?? 0) >= 800).toBe(true);

    state = tickPromptMachine(
      state,
      { now_ms: 20_000 + PROMPT_SOFT_FADE_START_MS + 100, session_elapsed_s: 35.2 },
      PROMPT_LIBRARY,
    ).state;
    expect(state.lifecycle).toBe("fading");
    expect((state.active_prompt?.elapsed_visible_ms ?? 0) >= PROMPT_TIMER_DOT_MS).toBe(
      false,
    );

    state = tickPromptMachine(
      state,
      { now_ms: 20_000 + PROMPT_TIMER_DOT_MS + 100, session_elapsed_s: 45.2 },
      PROMPT_LIBRARY,
    ).state;
    expect(state.lifecycle).toBe("fading");

    state = tickPromptMachine(
      state,
      { now_ms: 20_000 + PROMPT_DISMISS_START_MS + 100, session_elapsed_s: 50.2 },
      PROMPT_LIBRARY,
    ).state;
    expect(state.lifecycle).toBe("fading");

    const gone = tickPromptMachine(
      state,
      { now_ms: 20_000 + PROMPT_REMOVE_MS + 1, session_elapsed_s: 55 },
      PROMPT_LIBRARY,
    );
    expect(gone.state.active_prompt).toBeNull();
    expect(gone.state.lifecycle).toBe("idle");
    expect(gone.events.some((e) => e.type === "prompt_dismissed")).toBe(true);
  });

  it("pauses prompt timeout while pointer is near prompt zone", () => {
    let state = createPromptMachineState(0);
    state = tickPromptMachine(
      state,
      {
        now_ms: 20_000,
        session_elapsed_s: 20,
        requested_trigger: "time",
      },
      PROMPT_LIBRARY,
    ).state;

    state = tickPromptMachine(
      state,
      {
        now_ms: 35_000,
        session_elapsed_s: 35,
        hold_pointer_near_prompt: true,
      },
      PROMPT_LIBRARY,
    ).state;

    expect(state.active_prompt).not.toBeNull();
    expect((state.active_prompt?.elapsed_visible_ms ?? 0)).toBe(0);
  });

  it("records response latency and clears active prompt on chip response", () => {
    let state = createPromptMachineState(0);
    const shown = tickPromptMachine(
      state,
      { now_ms: 20_000, session_elapsed_s: 20, requested_trigger: "time" },
      PROMPT_LIBRARY,
    );
    state = shown.state;
    const active = state.active_prompt;
    expect(active).not.toBeNull();

    const response = respondToPrompt(state, {
      now_ms: 21_250,
      chip_id: active?.chips[0]?.id ?? "deep",
      chip_label: active?.chips[0]?.label ?? "somewhere deep",
    });

    expect(response.state.active_prompt).toBeNull();
    expect(response.state.response_count).toBe(1);
    const respondedEvent = response.events.find((e) => e.type === "prompt_responded");
    expect(respondedEvent?.type).toBe("prompt_responded");
    if (respondedEvent?.type === "prompt_responded") {
      expect(respondedEvent.response_latency_ms).toBe(1250);
    }
  });
});

