import type { PromptDefinition } from "@/contracts/prompt";
import type { VisualStateDelta } from "@/contracts/visual-state";

const chipDelta = (
  delta: Omit<VisualStateDelta, "source">,
): VisualStateDelta => ({
  ...delta,
  source: "chip",
});

export const PROMPT_LIBRARY_VERSION = 2 as const;

export const PROMPT_LIBRARY: PromptDefinition[] = [
  {
    id: "grounding-v2",
    phase: "grounding",
    variants: [
      "where does this feel like it's coming from",
      "where is this sound arriving from",
      "where is this landing in the room",
      "what part of the room is holding this",
      "where is the weight of this sitting",
      "where would you point if you had to",
    ],
    chips: [
      { id: "deep", label: "somewhere deep" },
      { id: "edges", label: "the edges" },
      { id: "around", label: "all around me" },
      { id: "here", label: "right on me" },
    ],
    chip_delta_map: {
      deep: chipDelta({
        set: { depth: 0.84, turbulence: 0.2, scale: 0.6, vignette: 0.42 },
        add: { blur: 0.03 },
        lerp_ms: 1800,
      }),
      edges: chipDelta({
        set: {
          flow_direction: 320,
          particle_density: 0.52,
          depth: 0.38,
          vignette: 0.6,
        },
        add: { hue_chaos: 0.08, wave_speed: 0.06 },
        lerp_ms: 1650,
      }),
      around: chipDelta({
        set: {
          depth: 0.62,
          particle_density: 0.64,
          turbulence: 0.42,
          scale: 0.5,
        },
        add: { pulse_strength: 0.04 },
        lerp_ms: 1700,
      }),
      here: chipDelta({
        set: { scale: 0.24, blur: 0.04, depth: 0.26, pulse_strength: 0.44 },
        add: { brightness: 0.06, turbulence: 0.05 },
        lerp_ms: 1450,
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
    id: "temperature-v2",
    phase: "temperature",
    variants: [
      "what's the temperature right now",
      "how does the air feel in here",
      "is this cold or burning",
      "what weather is this making",
      "does this feel like frost or skin heat",
      "if this touched you, what would it feel like",
    ],
    chips: [
      { id: "frozen", label: "frozen still" },
      { id: "cool", label: "cool air" },
      { id: "warm", label: "body warm" },
      { id: "burning", label: "midnight heat" },
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
          brightness: 0.28,
          saturation: 0.58,
          mood_pole: -0.18,
        },
        add: { depth: 0.03 },
        lerp_ms: 1600,
      }),
      warm: chipDelta({
        set: {
          hue_primary: 28,
          hue_secondary: 320,
          brightness: 0.44,
          saturation: 0.68,
          mood_pole: 0.2,
        },
        add: { pulse_strength: 0.08, blur: -0.03 },
        lerp_ms: 1600,
      }),
      burning: chipDelta({
        set: {
          hue_primary: 8,
          hue_secondary: 42,
          brightness: 0.56,
          saturation: 0.82,
          mood_pole: 0.54,
        },
        add: { turbulence: 0.14, pulse_strength: 0.16, wave_speed: 0.22 },
        lerp_ms: 1500,
      }),
    },
    oddball_seed: {
      enabled: true,
      chip_id: "burning",
      chance: 0.14,
    },
    trigger_hints: {
      min_t: 60,
      max_freq_s: 120,
      event_type: ["time", "energy_spike", "drop"],
    },
  },
  {
    id: "texture-v1",
    phase: "texture",
    variants: [
      "what is the surface of this",
      "what does the edge of this feel like",
      "if this had skin, what kind",
      "is this smooth, rough, or something stranger",
      "what texture is the room wearing right now",
      "how would your hand read this sound",
    ],
    chips: [
      { id: "glass", label: "smooth glass" },
      { id: "velvet", label: "soft velvet" },
      { id: "grain", label: "rough grain" },
      { id: "liquid", label: "liquid skin" },
    ],
    chip_delta_map: {
      glass: chipDelta({
        set: { turbulence: 0.14, blur: 0.04, particle_density: 0.28 },
        add: { hue_chaos: -0.05, wave_speed: -0.06 },
        lerp_ms: 1700,
      }),
      velvet: chipDelta({
        set: { blur: 0.2, turbulence: 0.24, brightness: 0.3, vignette: 0.45 },
        add: { pulse_strength: -0.05 },
        lerp_ms: 1900,
      }),
      grain: chipDelta({
        set: { turbulence: 0.62, particle_density: 0.78, blur: 0.06 },
        add: { hue_chaos: 0.14, wave_speed: 0.16 },
        lerp_ms: 1500,
      }),
      liquid: chipDelta({
        set: { turbulence: 0.46, wave_speed: 1.22, blur: 0.12 },
        add: { depth: 0.06, particle_density: -0.08 },
        lerp_ms: 1550,
      }),
    },
    oddball_seed: {
      enabled: true,
      chip_id: "liquid",
      chance: 0.2,
    },
    trigger_hints: {
      min_t: 95,
      max_freq_s: 120,
      event_type: ["time", "energy_spike"],
    },
  },
  {
    id: "space-v1",
    phase: "space",
    variants: [
      "how much room is this taking",
      "does this feel close or endless",
      "how far do the walls feel",
      "is this tiny, room-sized, or horizon-wide",
      "how much space is this opening up",
      "what size is this world right now",
    ],
    chips: [
      { id: "tiny", label: "tiny room" },
      { id: "room", label: "this room" },
      { id: "wide", label: "wide open" },
      { id: "endless", label: "no walls" },
    ],
    chip_delta_map: {
      tiny: chipDelta({
        set: { scale: 0.18, depth: 0.2, vignette: 0.62, blur: 0.08 },
        add: { pulse_strength: 0.07 },
        lerp_ms: 1700,
      }),
      room: chipDelta({
        set: { scale: 0.42, depth: 0.45, vignette: 0.44 },
        lerp_ms: 1600,
      }),
      wide: chipDelta({
        set: { scale: 0.66, depth: 0.72, vignette: 0.24, blur: 0.1 },
        add: { wave_speed: 0.1 },
        lerp_ms: 1800,
      }),
      endless: chipDelta({
        set: { scale: 0.88, depth: 0.9, vignette: 0.1, blur: 0.16 },
        add: { hue_chaos: 0.08, particle_density: 0.08 },
        lerp_ms: 1900,
      }),
    },
    oddball_seed: {
      enabled: true,
      chip_id: "endless",
      chance: 0.16,
    },
    trigger_hints: {
      min_t: 130,
      max_freq_s: 140,
      event_type: ["time", "drop"],
    },
  },
  {
    id: "taste-v1",
    phase: "taste",
    variants: [
      "if this had a taste, what is it",
      "what flavor is hiding in this",
      "does this feel sweet, bitter, metallic",
      "what taste-note keeps showing up",
      "if the bass had a flavor, what would it be",
      "what is the aftertaste of this sound",
    ],
    chips: [
      { id: "sweet", label: "sweet glow" },
      { id: "salty", label: "salt air" },
      { id: "bitter", label: "bitter edge" },
      { id: "metal", label: "metal mouth" },
    ],
    chip_delta_map: {
      sweet: chipDelta({
        set: { brightness: 0.46, saturation: 0.78, hue_secondary: 330 },
        add: { blur: 0.05, pulse_strength: 0.05 },
        lerp_ms: 1700,
      }),
      salty: chipDelta({
        set: { hue_primary: 196, hue_secondary: 246, saturation: 0.58, depth: 0.62 },
        add: { particle_density: 0.08, wave_speed: -0.04 },
        lerp_ms: 1750,
      }),
      bitter: chipDelta({
        set: { brightness: 0.22, saturation: 0.5, vignette: 0.58 },
        add: { turbulence: 0.1, hue_chaos: 0.06 },
        lerp_ms: 1650,
      }),
      metal: chipDelta({
        set: { hue_primary: 210, hue_secondary: 300, saturation: 0.4, blur: 0.05 },
        add: { particle_density: 0.16, pulse_strength: 0.12, turbulence: 0.08 },
        lerp_ms: 1500,
      }),
    },
    oddball_seed: {
      enabled: true,
      chip_id: "metal",
      chance: 0.22,
    },
    trigger_hints: {
      min_t: 170,
      max_freq_s: 150,
      event_type: ["time", "energy_spike", "drop"],
    },
  },
  {
    id: "narrative-v1",
    phase: "narrative",
    variants: [
      "what is this trying to do",
      "what kind of scene is this becoming",
      "what's happening here, if this is a moment",
      "is this arriving, circling, or leaving",
      "what story shape is this taking",
      "if this is a scene cut, what kind is it",
    ],
    chips: [
      { id: "arriving", label: "something arrives" },
      { id: "circling", label: "it keeps circling" },
      { id: "breaking", label: "it breaks open" },
      { id: "floating", label: "it won't land" },
    ],
    chip_delta_map: {
      arriving: chipDelta({
        set: { flow_direction: 12, pulse_strength: 0.52, depth: 0.48 },
        add: { wave_speed: 0.16, brightness: 0.04 },
        lerp_ms: 1500,
      }),
      circling: chipDelta({
        set: { flow_direction: 220, turbulence: 0.44, particle_density: 0.58 },
        add: { hue_chaos: 0.1, wave_speed: 0.08 },
        lerp_ms: 1650,
      }),
      breaking: chipDelta({
        set: { pulse_strength: 0.74, turbulence: 0.64, brightness: 0.5 },
        add: { particle_density: 0.12, wave_speed: 0.22, blur: -0.04 },
        lerp_ms: 1400,
      }),
      floating: chipDelta({
        set: { wave_speed: 0.52, blur: 0.22, depth: 0.7, pulse_strength: 0.2 },
        add: { brightness: -0.03, vignette: -0.06 },
        lerp_ms: 1900,
      }),
    },
    oddball_seed: {
      enabled: true,
      chip_id: "floating",
      chance: 0.18,
    },
    trigger_hints: {
      min_t: 210,
      max_freq_s: 160,
      event_type: ["time", "drop", "bpm_shift"],
    },
  },
];

export const PROMPTS_BY_PHASE = Object.freeze(
  PROMPT_LIBRARY.reduce<Record<string, PromptDefinition>>((acc, prompt) => {
    acc[prompt.phase] = prompt;
    return acc;
  }, {}),
);
