export const VISUAL_STATE_VERSION = 1 as const;

export interface VisualState {
  _version: number;
  _timestamp: number;

  // Color
  hue_primary: number; // 0..360
  hue_secondary: number; // 0..360
  saturation: number; // 0..1
  brightness: number; // 0..1
  hue_chaos: number; // 0..1
  mood_pole: number; // -1..1

  // Movement
  turbulence: number; // 0..1
  wave_speed: number; // 0..2
  particle_density: number; // 0..1
  flow_direction: number; // 0..360
  pulse_strength: number; // 0..1

  // Space
  depth: number; // 0..1
  scale: number; // 0..1
  blur: number; // 0..1
  vignette: number; // 0..1
}

export type VisualStateParams = Omit<VisualState, "_version" | "_timestamp">;

export type VisualStateWriterSource =
  | "chip"
  | "mood_bar"
  | "audio"
  | "onboarding"
  | "replay"
  | "ai";

export interface VisualStateDelta {
  set?: Partial<VisualStateParams>;
  add?: Partial<VisualStateParams>;
  lerp_ms?: number;
  source?: VisualStateWriterSource;
}

