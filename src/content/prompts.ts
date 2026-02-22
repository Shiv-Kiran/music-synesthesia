import type { PromptDefinition } from "@/contracts/prompt";
import type { VisualStateDelta } from "@/contracts/visual-state";

const chipDelta = (
  delta: Omit<VisualStateDelta, "source">,
): VisualStateDelta => ({
  ...delta,
  source: "chip",
});

export const PROMPT_LIBRARY_VERSION = 1 as const;

export const PROMPT_LIBRARY: PromptDefinition[] = [
  {
    id: "grounding-v1",
    phase: "grounding",
    variants: [
      "where does this feel like it's coming from",
      "where is this sound arriving from",
      "where is this landing in the room",
    ],
    chips: [
      { id: "deep", label: "somewhere deep" },
      { id: "edges", label: "the edges" },
      { id: "around", label: "all around" },
      { id: "far", label: "somewhere far away" },
      { id: "here", label: "right here" },
    ],
    chip_delta_map: {
      deep: chipDelta({
        set: { depth: 0.82, turbulence: 0.18, scale: 0.6, vignette: 0.4 },
        lerp_ms: 1800,
      }),
      edges: chipDelta({
        set: {
          flow_direction: 320,
          particle_density: 0.5,
          depth: 0.35,
          vignette: 0.58,
        },
        add: { hue_chaos: 0.08 },
        lerp_ms: 1600,
      }),
      around: chipDelta({
        set: {
          depth: 0.6,
          particle_density: 0.62,
          turbulence: 0.4,
          scale: 0.5,
        },
        lerp_ms: 1700,
      }),
      far: chipDelta({
        set: { scale: 0.75, blur: 0.22, brightness: 0.24, depth: 0.7 },
        add: { wave_speed: -0.1 },
        lerp_ms: 2100,
      }),
      here: chipDelta({
        set: { scale: 0.22, blur: 0.04, depth: 0.25, pulse_strength: 0.4 },
        add: { brightness: 0.06 },
        lerp_ms: 1400,
      }),
    },
    oddball_seed: {
      enabled: true,
      chip_id: "edges",
      chance: 0.18,
    },
    trigger_hints: {
      min_t: 20,
      max_freq_s: 90,
      event_type: ["time", "drop"],
    },
  },
  {
    id: "temperature-v1",
    phase: "temperature",
    variants: [
      "what's the temperature right now",
      "how does the air feel in here",
      "is this cold or burning",
    ],
    chips: [
      { id: "frozen", label: "frozen still" },
      { id: "cool", label: "cool air" },
      { id: "warm", label: "body warm" },
      { id: "burning", label: "burning slow" },
      { id: "other", label: "something else" },
    ],
    chip_delta_map: {
      frozen: chipDelta({
        set: {
          hue_primary: 220,
          hue_secondary: 255,
          brightness: 0.2,
          saturation: 0.5,
          mood_pole: -0.45,
        },
        add: { blur: 0.08, wave_speed: -0.08 },
        lerp_ms: 1700,
      }),
      cool: chipDelta({
        set: {
          hue_primary: 205,
          hue_secondary: 270,
          brightness: 0.27,
          saturation: 0.58,
          mood_pole: -0.2,
        },
        lerp_ms: 1600,
      }),
      warm: chipDelta({
        set: {
          hue_primary: 28,
          hue_secondary: 320,
          brightness: 0.42,
          saturation: 0.68,
          mood_pole: 0.18,
        },
        add: { pulse_strength: 0.08 },
        lerp_ms: 1600,
      }),
      burning: chipDelta({
        set: {
          hue_primary: 8,
          hue_secondary: 42,
          brightness: 0.58,
          saturation: 0.82,
          mood_pole: 0.52,
        },
        add: { turbulence: 0.12, pulse_strength: 0.15, wave_speed: 0.2 },
        lerp_ms: 1500,
      }),
      other: chipDelta({
        add: {
          hue_chaos: 0.18,
          brightness: 0.05,
          saturation: 0.06,
          flow_direction: 35,
        },
        lerp_ms: 1900,
      }),
    },
    oddball_seed: {
      enabled: true,
      chip_id: "other",
      chance: 0.12,
    },
    trigger_hints: {
      min_t: 60,
      max_freq_s: 120,
      event_type: ["time", "energy_spike", "drop"],
    },
  },
];

export const PROMPTS_BY_PHASE = Object.freeze(
  PROMPT_LIBRARY.reduce<Record<string, PromptDefinition>>((acc, prompt) => {
    acc[prompt.phase] = prompt;
    return acc;
  }, {}),
);

