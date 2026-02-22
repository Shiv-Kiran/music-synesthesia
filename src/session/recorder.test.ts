import { describe, expect, it } from "vitest";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { normalizeVisualState } from "@/contracts/normalize";
import type { SessionFingerprint } from "@/contracts/session";
import { createSessionRecorder } from "@/session/recorder";

function makeVisual(
  overrides: Partial<typeof DEFAULT_VISUAL_STATE> = {},
  timestamp = 0,
) {
  return normalizeVisualState({ ...DEFAULT_VISUAL_STATE, ...overrides }, timestamp);
}

describe("session recorder", () => {
  it("starts a new draft and applies non-prompt snapshot defaults", () => {
    const recorder = createSessionRecorder();

    const started = recorder.startNew({
      initial_preset: makeVisual({ hue_primary: 240 }, 1_000),
      nowEpochMs: 1_000,
    });

    expect(started.id).toMatch(/^qualia_/);
    expect(started.ended_at).toBe("");
    expect(started.mode).toBe("free");
    expect(started.timeline).toHaveLength(0);

    const snapshot = recorder.recordSnapshot({
      trigger: "time",
      visual_state: makeVisual({ hue_primary: 245, brightness: 0.4 }, 1_500),
      audio_features: {
        rms: 0.12,
        bass_energy: 0.4,
        mid_energy: 0.3,
        high_energy: 0.2,
        spectral_centroid: 0.5,
        zero_crossing_rate: 0.1,
        bpm_estimate: 124,
      },
      nowEpochMs: 1_500,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.t).toBe(500);
    expect(snapshot?.prompt_phase).toBe("grounding");
    expect(snapshot?.prompt_text).toBe("");
    expect(snapshot?.user_response).toBe("");
    expect(snapshot?.response_latency_ms).toBe(0);
    expect(snapshot?.audio_snapshot.bpm).toBe(124);

    const draft = recorder.getDraft();
    expect(draft?.timeline).toHaveLength(1);
    expect(draft?.dominant_state.hue_primary).toBeCloseTo(245, 5);
  });

  it("resumes an existing draft session and appends snapshots using the same id", () => {
    const recorder1 = createSessionRecorder();
    const started = recorder1.startNew({
      initial_preset: makeVisual({}, 10_000),
      nowEpochMs: 10_000,
    });
    recorder1.recordSnapshot({
      trigger: "time",
      visual_state: makeVisual({ mood_pole: -0.2 }, 10_500),
      nowEpochMs: 10_500,
    });
    const savedDraft = recorder1.getDraft() as SessionFingerprint;

    const recorder2 = createSessionRecorder();
    const resumed = recorder2.resumeDraft(savedDraft, { nowEpochMs: 11_000 });
    expect(resumed.id).toBe(started.id);
    expect(resumed.timeline).toHaveLength(1);

    const nextSnapshot = recorder2.recordSnapshot({
      trigger: "user_initiated",
      visual_state: makeVisual({ mood_pole: 0.7 }, 11_100),
      prompt: {
        prompt_phase: "temperature",
        prompt_text: "more heat or more cool?",
        user_response: "warmer",
        response_latency_ms: 420,
      },
      nowEpochMs: 11_100,
    });

    expect(nextSnapshot?.t).toBe(1_100);
    expect(nextSnapshot?.prompt_phase).toBe("temperature");
    expect(nextSnapshot?.user_response).toBe("warmer");
    expect(nextSnapshot?.response_latency_ms).toBe(420);
    expect(recorder2.getDraft()?.id).toBe(started.id);
    expect(recorder2.getDraft()?.timeline).toHaveLength(2);
  });

  it("derives dominant state using time-weighted averaging with wrapped hue handling", () => {
    const recorder = createSessionRecorder();

    recorder.startNew({
      initial_preset: makeVisual({}, 0),
      nowEpochMs: 0,
    });
    recorder.recordSnapshot({
      trigger: "time",
      visual_state: makeVisual({ hue_primary: 350, brightness: 0.2 }, 0),
      nowEpochMs: 0,
    });
    recorder.recordSnapshot({
      trigger: "time",
      visual_state: makeVisual({ hue_primary: 10, brightness: 0.8 }, 1_000),
      nowEpochMs: 1_000,
    });

    const ended = recorder.end({ nowEpochMs: 2_000 });
    expect(ended).not.toBeNull();
    expect(ended?.ended_at).not.toBe("");
    expect(ended?.dominant_state.brightness).toBeCloseTo(0.5, 2);
    expect(
      (ended?.dominant_state.hue_primary ?? 180) < 25 ||
        (ended?.dominant_state.hue_primary ?? 180) > 335,
    ).toBe(true);
  });

  it("does not record after session end", () => {
    const recorder = createSessionRecorder();
    recorder.startNew({
      initial_preset: makeVisual({}, 100),
      nowEpochMs: 100,
    });
    recorder.end({ nowEpochMs: 200 });

    const snapshot = recorder.recordSnapshot({
      trigger: "time",
      visual_state: makeVisual({}, 300),
      nowEpochMs: 300,
    });

    expect(snapshot).toBeNull();
  });
});
