import { describe, expect, it } from "vitest";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { applyVisualStateDelta, normalizeVisualState } from "@/contracts/normalize";
import { PROMPT_LIBRARY, PROMPT_LIBRARY_VERSION, PROMPTS_BY_PHASE } from "@/content/prompts";

describe("PROMPT_LIBRARY", () => {
  it("ships a richer deterministic prompt library for beta testing", () => {
    expect(PROMPT_LIBRARY_VERSION).toBe(2);
    expect(PROMPT_LIBRARY.map((prompt) => prompt.phase)).toEqual([
      "grounding",
      "temperature",
      "texture",
      "space",
      "taste",
      "narrative",
    ]);
    expect(PROMPTS_BY_PHASE.grounding).toBeDefined();
    expect(PROMPTS_BY_PHASE.temperature).toBeDefined();
    expect(PROMPTS_BY_PHASE.texture).toBeDefined();
    expect(PROMPTS_BY_PHASE.space).toBeDefined();
    expect(PROMPTS_BY_PHASE.taste).toBeDefined();
    expect(PROMPTS_BY_PHASE.narrative).toBeDefined();
  });

  it("keeps chip definitions and chip delta mappings aligned", () => {
    for (const prompt of PROMPT_LIBRARY) {
      const chipIds = prompt.chips.map((chip) => chip.id).sort();
      const mappedIds = Object.keys(prompt.chip_delta_map).sort();

      expect(prompt.variants.length).toBeGreaterThanOrEqual(6);
      expect(chipIds.length).toBe(4);
      expect(mappedIds).toEqual(chipIds);

      for (const chip of prompt.chips) {
        const delta = prompt.chip_delta_map[chip.id];
        const next = applyVisualStateDelta(
          normalizeVisualState(DEFAULT_VISUAL_STATE, 1),
          delta,
          2,
        );

        expect(next._timestamp).toBe(2);
        expect(Number.isFinite(next.hue_primary)).toBe(true);
        expect(next.brightness).toBeGreaterThanOrEqual(0);
        expect(next.brightness).toBeLessThanOrEqual(1);
        expect(next.wave_speed).toBeGreaterThanOrEqual(0);
        expect(next.wave_speed).toBeLessThanOrEqual(2);
      }
    }
  });
});
