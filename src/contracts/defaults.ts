import type { VisualState, VisualStateParams } from "@/contracts/visual-state";
import { VISUAL_STATE_VERSION } from "@/contracts/visual-state";

export const DEFAULT_VISUAL_LERP_MS = 1800;

export const DEFAULT_VISUAL_STATE: VisualState = {
  _version: VISUAL_STATE_VERSION,
  _timestamp: 0,
  hue_primary: 250,
  hue_secondary: 310,
  saturation: 0.62,
  brightness: 0.28,
  hue_chaos: 0.15,
  mood_pole: 0,
  turbulence: 0.22,
  wave_speed: 0.4,
  particle_density: 0.35,
  flow_direction: 210,
  pulse_strength: 0.3,
  depth: 0.45,
  scale: 0.42,
  blur: 0.08,
  vignette: 0.24,
  focal_intensity: 0.62,
  focal_size: 0.48,
  focal_sharpness: 0.38,
  focal_drift: 0.22,
  background_reactivity: 0.24,
};

export interface VisualStateRange {
  min: number;
  max: number;
  wrap?: boolean;
}

export const VISUAL_STATE_PARAM_RANGES: Record<
  keyof VisualStateParams,
  VisualStateRange
> = {
  hue_primary: { min: 0, max: 360, wrap: true },
  hue_secondary: { min: 0, max: 360, wrap: true },
  saturation: { min: 0, max: 1 },
  brightness: { min: 0, max: 1 },
  hue_chaos: { min: 0, max: 1 },
  mood_pole: { min: -1, max: 1 },
  turbulence: { min: 0, max: 1 },
  wave_speed: { min: 0, max: 2 },
  particle_density: { min: 0, max: 1 },
  flow_direction: { min: 0, max: 360, wrap: true },
  pulse_strength: { min: 0, max: 1 },
  depth: { min: 0, max: 1 },
  scale: { min: 0, max: 1 },
  blur: { min: 0, max: 1 },
  vignette: { min: 0, max: 1 },
  focal_intensity: { min: 0, max: 1 },
  focal_size: { min: 0, max: 1 },
  focal_sharpness: { min: 0, max: 1 },
  focal_drift: { min: 0, max: 1 },
  background_reactivity: { min: 0, max: 1 },
};
