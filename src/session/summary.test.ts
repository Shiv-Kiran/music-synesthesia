import { describe, expect, it } from "vitest";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { normalizeVisualState } from "@/contracts/normalize";
import type { SessionFingerprint } from "@/contracts/session";
import {
  buildLocalSessionSummary,
  canBuildLocalSessionSummary,
} from "@/session/summary";

function makeSession(overrides: Partial<SessionFingerprint> = {}): SessionFingerprint {
  const visual = normalizeVisualState(DEFAULT_VISUAL_STATE, 123);
  return {
    id: "summary-test",
    started_at: new Date(0).toISOString(),
    ended_at: "",
    mode: "free",
    timeline: [],
    initial_preset: visual,
    dominant_state: visual,
    ...overrides,
  };
}

describe("session summary stubs", () => {
  it("reports whether a local summary can be built", () => {
    expect(canBuildLocalSessionSummary(makeSession())).toBe(false);
    expect(
      canBuildLocalSessionSummary(
        makeSession({
          ended_at: new Date(1_000).toISOString(),
          timeline: [
            {
              t: 0,
              trigger: "time",
              prompt_phase: "grounding",
              prompt_text: "",
              user_response: "",
              response_latency_ms: 0,
              visual_state: normalizeVisualState(DEFAULT_VISUAL_STATE, 100),
              audio_snapshot: {
                rms: 0,
                bass_energy: 0,
                mid_energy: 0,
                high_energy: 0,
                spectral_centroid: 0,
                zero_crossing_rate: 0,
              },
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("returns undefined summary in PR-09 stub", () => {
    expect(buildLocalSessionSummary(makeSession())).toBeUndefined();
  });
});
