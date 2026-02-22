import type { VisualState } from "@/contracts/visual-state";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function expSmoothingFactor(dtSeconds: number, speed = 6): number {
  return 1 - Math.exp(-speed * Math.max(dtSeconds, 0));
}

export function lerpAngleDegrees(a: number, b: number, t: number): number {
  let delta = ((b - a + 540) % 360) - 180;
  if (!Number.isFinite(delta)) {
    delta = 0;
  }
  return (a + delta * t + 360) % 360;
}

export function interpolateVisualState(
  current: VisualState,
  target: VisualState,
  t: number,
): VisualState {
  return {
    _version: target._version,
    _timestamp: target._timestamp,
    hue_primary: lerpAngleDegrees(current.hue_primary, target.hue_primary, t),
    hue_secondary: lerpAngleDegrees(
      current.hue_secondary,
      target.hue_secondary,
      t,
    ),
    saturation: lerp(current.saturation, target.saturation, t),
    brightness: lerp(current.brightness, target.brightness, t),
    hue_chaos: lerp(current.hue_chaos, target.hue_chaos, t),
    mood_pole: lerp(current.mood_pole, target.mood_pole, t),
    turbulence: lerp(current.turbulence, target.turbulence, t),
    wave_speed: lerp(current.wave_speed, target.wave_speed, t),
    particle_density: lerp(current.particle_density, target.particle_density, t),
    flow_direction: lerpAngleDegrees(
      current.flow_direction,
      target.flow_direction,
      t,
    ),
    pulse_strength: lerp(current.pulse_strength, target.pulse_strength, t),
    depth: lerp(current.depth, target.depth, t),
    scale: lerp(current.scale, target.scale, t),
    blur: lerp(current.blur, target.blur, t),
    vignette: lerp(current.vignette, target.vignette, t),
  };
}

