import {
  DEFAULT_VISUAL_LERP_MS,
  DEFAULT_VISUAL_STATE,
  VISUAL_STATE_PARAM_RANGES,
} from "@/contracts/defaults";
import type {
  VisualState,
  VisualStateDelta,
  VisualStateParams,
} from "@/contracts/visual-state";
import { VISUAL_STATE_VERSION } from "@/contracts/visual-state";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeDegrees(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function normalizeParamValue<K extends keyof VisualStateParams>(
  key: K,
  value: unknown,
  fallback: VisualStateParams[K],
): VisualStateParams[K] {
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  const range = VISUAL_STATE_PARAM_RANGES[key];
  if (range.wrap) {
    const normalized = normalizeDegrees(value);
    // Keep 360 valid if caller explicitly sets it; otherwise values wrap to [0, 360).
    return (normalized === 0 && value === 360 ? 360 : normalized) as VisualStateParams[K];
  }

  return clamp(value, range.min, range.max) as VisualStateParams[K];
}

export function normalizeVisualStateParams(
  input?: Partial<VisualStateParams>,
): VisualStateParams {
  const defaults = DEFAULT_VISUAL_STATE;
  const source = input ?? {};

  return {
    hue_primary: normalizeParamValue(
      "hue_primary",
      source.hue_primary,
      defaults.hue_primary,
    ),
    hue_secondary: normalizeParamValue(
      "hue_secondary",
      source.hue_secondary,
      defaults.hue_secondary,
    ),
    saturation: normalizeParamValue(
      "saturation",
      source.saturation,
      defaults.saturation,
    ),
    brightness: normalizeParamValue(
      "brightness",
      source.brightness,
      defaults.brightness,
    ),
    hue_chaos: normalizeParamValue(
      "hue_chaos",
      source.hue_chaos,
      defaults.hue_chaos,
    ),
    mood_pole: normalizeParamValue("mood_pole", source.mood_pole, defaults.mood_pole),
    turbulence: normalizeParamValue(
      "turbulence",
      source.turbulence,
      defaults.turbulence,
    ),
    wave_speed: normalizeParamValue(
      "wave_speed",
      source.wave_speed,
      defaults.wave_speed,
    ),
    particle_density: normalizeParamValue(
      "particle_density",
      source.particle_density,
      defaults.particle_density,
    ),
    flow_direction: normalizeParamValue(
      "flow_direction",
      source.flow_direction,
      defaults.flow_direction,
    ),
    pulse_strength: normalizeParamValue(
      "pulse_strength",
      source.pulse_strength,
      defaults.pulse_strength,
    ),
    depth: normalizeParamValue("depth", source.depth, defaults.depth),
    scale: normalizeParamValue("scale", source.scale, defaults.scale),
    blur: normalizeParamValue("blur", source.blur, defaults.blur),
    vignette: normalizeParamValue("vignette", source.vignette, defaults.vignette),
    focal_intensity: normalizeParamValue(
      "focal_intensity",
      source.focal_intensity,
      defaults.focal_intensity,
    ),
    focal_size: normalizeParamValue(
      "focal_size",
      source.focal_size,
      defaults.focal_size,
    ),
    focal_sharpness: normalizeParamValue(
      "focal_sharpness",
      source.focal_sharpness,
      defaults.focal_sharpness,
    ),
    focal_drift: normalizeParamValue(
      "focal_drift",
      source.focal_drift,
      defaults.focal_drift,
    ),
    background_reactivity: normalizeParamValue(
      "background_reactivity",
      source.background_reactivity,
      defaults.background_reactivity,
    ),
  };
}

export function normalizeVisualState(
  input?: Partial<VisualState>,
  timestamp = Date.now(),
): VisualState {
  const source = input ?? {};
  const version =
    isFiniteNumber(source._version) && source._version > 0
      ? Math.trunc(source._version)
      : VISUAL_STATE_VERSION;
  const normalizedTimestamp = isFiniteNumber(source._timestamp)
    ? source._timestamp
    : timestamp;

  return {
    _version: version,
    _timestamp: normalizedTimestamp,
    ...normalizeVisualStateParams(source),
  };
}

export function applyVisualStateDelta(
  state: VisualState,
  delta: VisualStateDelta,
  timestamp = Date.now(),
): VisualState {
  const base = normalizeVisualState(state, timestamp);
  const set = delta.set ?? {};
  const add = delta.add ?? {};
  const nextParams: Partial<VisualStateParams> = { ...base, ...set };

  for (const [rawKey, rawValue] of Object.entries(add) as Array<
    [keyof VisualStateParams, number | undefined]
  >) {
    if (!isFiniteNumber(rawValue)) {
      continue;
    }

    const current = (nextParams[rawKey] ?? base[rawKey]) as number;
    nextParams[rawKey] = current + rawValue;
  }

  return {
    _version: base._version,
    _timestamp: timestamp,
    ...normalizeVisualStateParams(nextParams),
  };
}

export function getDeltaLerpMs(delta?: VisualStateDelta): number {
  return isFiniteNumber(delta?.lerp_ms) && (delta?.lerp_ms ?? 0) >= 0
    ? (delta?.lerp_ms as number)
    : DEFAULT_VISUAL_LERP_MS;
}
