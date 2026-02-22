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

