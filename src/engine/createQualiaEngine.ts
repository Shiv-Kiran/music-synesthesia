import * as THREE from "three";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { normalizeVisualState } from "@/contracts/normalize";
import type { VisualState } from "@/contracts/visual-state";
import {
  expSmoothingFactor,
  interpolateVisualState,
} from "@/engine/interpolate";

export interface QualiaEngine {
  applyVisualState: (state: VisualState) => void;
  resize: (width?: number, height?: number) => void;
  dispose: () => void;
}

export interface QualiaEngineOptions {
  transitionSmoothing?: boolean;
}

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uHuePair;
uniform float uSaturation;
uniform float uBrightness;
uniform float uHueChaos;
uniform float uMoodPole;
uniform float uTurbulence;
uniform float uWaveSpeed;
uniform float uParticleDensity;
uniform float uFlowDirection;
uniform float uPulseStrength;
uniform float uDepth;
uniform float uScale;
uniform float uBlur;
uniform float uVignette;
uniform float uBoomEnvelope;
uniform float uBoomRing;
uniform float uBoomAge;
uniform float uBoomWarp;
uniform float uBoomFlash;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec3 hsl2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  uv.x *= aspect;

  vec2 boomCenter = vec2(0.0, 0.08);
  vec2 boomVec = uv - boomCenter;
  float boomDist = length(boomVec);
  vec2 boomDir = boomDist > 0.0001 ? boomVec / boomDist : vec2(0.0, 1.0);

  float ringRadius = 0.045 + uBoomAge * (0.42 + uWaveSpeed * 0.18);
  float ringWidth = mix(0.018, 0.055, clamp(uBoomRing, 0.0, 1.0));
  float ringBand = exp(-pow((boomDist - ringRadius) / max(ringWidth, 0.0001), 2.0));
  float centerCompression = exp(-pow(boomDist / 0.24, 2.0)) * uBoomEnvelope;
  float localPressure = smoothstep(0.95, 0.0, boomDist);
  float pressureWarp =
    (-centerCompression * 0.012 + ringBand * uBoomWarp * 0.01) * localPressure;
  uv += boomDir * pressureWarp;

  float angle = radians(uFlowDirection);
  mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  uv = rot * uv;

  float scale = mix(0.7, 3.0, clamp(uScale, 0.0, 1.0));
  float t = uTime * (0.15 + uWaveSpeed * 0.6);
  vec2 q = uv * scale;

  float n1 = noise(q * (1.4 + uTurbulence * 3.0) + vec2(t * 0.8, -t * 0.5));
  float n2 = noise((q + 3.0) * (2.2 + uTurbulence * 4.0) - vec2(t * 0.4, t * 0.9));
  float ridges = abs(sin((n1 * 3.5 + n2 * 2.0 + t) * 3.14159));

  float pulse = sin(uTime * (0.8 + uWaveSpeed * 2.0)) * 0.5 + 0.5;
  pulse = mix(0.0, pulse, uPulseStrength);

  float haze = smoothstep(0.0, 1.0, n1 * 0.8 + ridges * 0.4 + pulse * 0.25);
  float depthField = smoothstep(1.2, 0.05, length(uv) * mix(1.2, 0.7, uDepth));
  float grain = (hash(gl_FragCoord.xy * 0.013 + vec2(uTime * 0.1)) - 0.5) * 0.06;

  float sparkle = step(1.0 - (0.02 + uParticleDensity * 0.08), hash(floor((uv + t * 0.02) * 70.0)));
  sparkle *= 0.35 + 0.65 * pulse;
  ringBand *= 0.75 + 0.25 * ridges;

  float hueMix = fract(haze + n2 * (0.08 + uHueChaos * 0.25) + pulse * 0.05);
  float hueA = fract(uHuePair.x / 360.0 + (uMoodPole * 0.03));
  float hueB = fract(uHuePair.y / 360.0 - (uMoodPole * 0.02));
  float hue = mix(hueA, hueB, hueMix);
  hue = fract(hue + (n1 - 0.5) * uHueChaos * 0.18);

  float sat = clamp(uSaturation + sparkle * 0.12 + uTurbulence * 0.05, 0.0, 1.0);
  float light = clamp(
    uBrightness * 0.6 +
    haze * 0.28 +
    depthField * 0.14 +
    sparkle * 0.18 +
    grain * 0.4,
    0.0,
    1.0
  );

  vec3 color = hsl2rgb(vec3(hue, sat, light));

  float blurGlow = smoothstep(1.25, 0.0, length(uv)) * uBlur * 0.25;
  color += blurGlow;

  float idleHeartbeat = (sin(uTime * (0.7 + uWaveSpeed * 0.35)) * 0.5 + 0.5);
  float idleCore = exp(-pow(boomDist / 0.11, 2.2)) * (0.012 + 0.028 * uPulseStrength) * idleHeartbeat;

  float thumpRadius = 0.085 + uBoomEnvelope * 0.13;
  float thumpCore = exp(-pow(boomDist / max(thumpRadius, 0.0001), 2.4));
  float innerShadow = thumpCore * uBoomEnvelope * 0.08;
  float thumpLift = thumpCore * (0.025 + 0.12 * uBoomEnvelope) + idleCore;

  float ringAccent = ringBand * (0.02 + 0.22 * uBoomRing) * (0.7 + 0.3 * uPulseStrength);
  float ringHue = fract(mix(hueA, hueB, 0.42 + pulse * 0.08));
  vec3 ringColor = hsl2rgb(vec3(
    ringHue,
    clamp(uSaturation * 0.85 + sparkle * 0.05, 0.0, 1.0),
    clamp(0.45 + uBrightness * 0.35, 0.0, 1.0)
  ));

  color *= (1.0 - innerShadow);
  color += ringColor * ringAccent * (0.45 + 0.25 * uBoomFlash);
  color += ringColor * thumpLift * 0.12;
  color += vec3(1.0) * ringAccent * uBoomFlash * 0.035;

  float vignette = smoothstep(1.45, 0.25 + (1.0 - uVignette) * 0.6, length(uv));
  color *= mix(1.0, vignette, clamp(uVignette, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
`;

type Uniforms = {
  uTime: { value: number };
  uResolution: { value: THREE.Vector2 };
  uHuePair: { value: THREE.Vector2 };
  uSaturation: { value: number };
  uBrightness: { value: number };
  uHueChaos: { value: number };
  uMoodPole: { value: number };
  uTurbulence: { value: number };
  uWaveSpeed: { value: number };
  uParticleDensity: { value: number };
  uFlowDirection: { value: number };
  uPulseStrength: { value: number };
  uDepth: { value: number };
  uScale: { value: number };
  uBlur: { value: number };
  uVignette: { value: number };
  uBoomEnvelope: { value: number };
  uBoomRing: { value: number };
  uBoomAge: { value: number };
  uBoomWarp: { value: number };
  uBoomFlash: { value: number };
};

function createUniforms(): Uniforms {
  return {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uHuePair: { value: new THREE.Vector2(250, 310) },
    uSaturation: { value: DEFAULT_VISUAL_STATE.saturation },
    uBrightness: { value: DEFAULT_VISUAL_STATE.brightness },
    uHueChaos: { value: DEFAULT_VISUAL_STATE.hue_chaos },
    uMoodPole: { value: DEFAULT_VISUAL_STATE.mood_pole },
    uTurbulence: { value: DEFAULT_VISUAL_STATE.turbulence },
    uWaveSpeed: { value: DEFAULT_VISUAL_STATE.wave_speed },
    uParticleDensity: { value: DEFAULT_VISUAL_STATE.particle_density },
    uFlowDirection: { value: DEFAULT_VISUAL_STATE.flow_direction },
    uPulseStrength: { value: DEFAULT_VISUAL_STATE.pulse_strength },
    uDepth: { value: DEFAULT_VISUAL_STATE.depth },
    uScale: { value: DEFAULT_VISUAL_STATE.scale },
    uBlur: { value: DEFAULT_VISUAL_STATE.blur },
    uVignette: { value: DEFAULT_VISUAL_STATE.vignette },
    uBoomEnvelope: { value: 0 },
    uBoomRing: { value: 0 },
    uBoomAge: { value: 10 },
    uBoomWarp: { value: 0 },
    uBoomFlash: { value: 0 },
  };
}

function copyStateToUniforms(uniforms: Uniforms, state: VisualState): void {
  uniforms.uHuePair.value.set(state.hue_primary, state.hue_secondary);
  uniforms.uSaturation.value = state.saturation;
  uniforms.uBrightness.value = state.brightness;
  uniforms.uHueChaos.value = state.hue_chaos;
  uniforms.uMoodPole.value = state.mood_pole;
  uniforms.uTurbulence.value = state.turbulence;
  uniforms.uWaveSpeed.value = state.wave_speed;
  uniforms.uParticleDensity.value = state.particle_density;
  uniforms.uFlowDirection.value = state.flow_direction;
  uniforms.uPulseStrength.value = state.pulse_strength;
  uniforms.uDepth.value = state.depth;
  uniforms.uScale.value = state.scale;
  uniforms.uBlur.value = state.blur;
  uniforms.uVignette.value = state.vignette;
}

export function createQualiaEngine(
  canvas: HTMLCanvasElement,
  options: QualiaEngineOptions = {},
): QualiaEngine {
  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
  const transitionSmoothing = options.transitionSmoothing ?? true;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x070510, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const uniforms = createUniforms();
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  let disposed = false;
  let frameId = 0;
  let lastTimeMs = 0;
  let currentState = normalizeVisualState(DEFAULT_VISUAL_STATE, performance.now());
  let targetState = currentState;
  let impactEnvelope = 0;
  let impactRing = 0;
  let impactAge = 10;
  let impactFlash = 0;
  let lastImpactTriggerMs = -1000;
  let impactSignalSmoothed =
    currentState.pulse_strength * 0.82 +
    currentState.turbulence * 0.12 +
    Math.min(currentState.wave_speed / 2, 1) * 0.06;
  let previousImpactSignal = impactSignalSmoothed;

  const resize = (width?: number, height?: number) => {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.floor(width ?? rect.width));
    const nextHeight = Math.max(1, Math.floor(height ?? rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(nextWidth, nextHeight, false);
    uniforms.uResolution.value.set(nextWidth * dpr, nextHeight * dpr);
  };

  const renderLoop = (timeMs: number) => {
    if (disposed) {
      return;
    }

    if (lastTimeMs === 0) {
      lastTimeMs = timeMs;
    }

    const dt = Math.min((timeMs - lastTimeMs) / 1000, 0.1);
    lastTimeMs = timeMs;

    const alpha = transitionSmoothing ? expSmoothingFactor(dt, 5.5) : 1;
    currentState = interpolateVisualState(currentState, targetState, alpha);
    currentState._timestamp = timeMs;

    const impactSignal = clamp01(
      currentState.pulse_strength * 0.82 +
        currentState.turbulence * 0.12 +
        Math.min(currentState.wave_speed / 2, 1) * 0.06,
    );
    const smoothing = Math.min(1, dt * 14);
    impactSignalSmoothed += (impactSignal - impactSignalSmoothed) * smoothing;
    const rise = impactSignalSmoothed - previousImpactSignal;
    previousImpactSignal = impactSignalSmoothed;

    const impactCooldownMs = 90;
    if (
      timeMs - lastImpactTriggerMs >= impactCooldownMs &&
      impactSignalSmoothed > 0.18 &&
      rise > 0.012
    ) {
      const triggerStrength = clamp01(
        (impactSignalSmoothed - 0.18) * 2.0 + (rise - 0.012) * 24,
      );
      impactEnvelope = Math.max(impactEnvelope, 0.32 + triggerStrength * 0.78);
      impactRing = Math.max(impactRing, 0.35 + triggerStrength * 0.8);
      impactFlash = Math.max(impactFlash, 0.12 + triggerStrength * 0.42);
      impactAge = 0;
      lastImpactTriggerMs = timeMs;
    } else {
      impactAge = Math.min(10, impactAge + dt);
    }

    impactEnvelope *= Math.exp(-dt * (4.4 + currentState.wave_speed * 0.65));
    impactRing *= Math.exp(-dt * 5.8);
    impactFlash *= Math.exp(-dt * 8.6);

    uniforms.uBoomEnvelope.value = clamp01(impactEnvelope);
    uniforms.uBoomRing.value = clamp01(impactRing);
    uniforms.uBoomAge.value = impactAge;
    uniforms.uBoomWarp.value = clamp01(impactEnvelope * 0.75 + impactRing * 0.55);
    uniforms.uBoomFlash.value = clamp01(impactFlash);

    uniforms.uTime.value = timeMs / 1000;
    copyStateToUniforms(uniforms, currentState);
    renderer.render(scene, camera);

    frameId = window.requestAnimationFrame(renderLoop);
  };

  const applyVisualState = (state: VisualState) => {
    targetState = normalizeVisualState(state, performance.now());
  };

  resize();
  copyStateToUniforms(uniforms, currentState);
  frameId = window.requestAnimationFrame(renderLoop);

  return {
    applyVisualState,
    resize,
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

