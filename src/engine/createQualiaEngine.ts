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
uniform float uFocalIntensity;
uniform float uFocalSize;
uniform float uFocalSharpness;
uniform float uFocalDrift;
uniform float uBackgroundReactivity;

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

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.55;
  value += noise(p) * amp;
  p = p * 2.03 + vec2(13.2, -8.7);
  amp *= 0.5;
  value += noise(p) * amp;
  p = p * 2.01 + vec2(-7.1, 5.3);
  amp *= 0.5;
  value += noise(p) * amp;
  return value;
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
  vec2 uvFlow = rot * uv;
  float pulseBase = sin(uTime * (0.9 + uWaveSpeed * 2.0)) * 0.5 + 0.5;
  float pulse = mix(pulseBase * 0.2, pulseBase, clamp(uPulseStrength, 0.0, 1.0));

  float grain = (hash(gl_FragCoord.xy * 0.013 + vec2(uTime * 0.1)) - 0.5) * 0.05;
  float depthField = smoothstep(1.25, 0.05, length(uv) * mix(1.16, 0.72, uDepth));

  // Background layer: slower atmospheric flow, lower contrast, mild audio response.
  float bgScale = mix(0.55, 2.15, clamp(uScale, 0.0, 1.0));
  float bgT = uTime * (0.05 + uWaveSpeed * (0.15 + 0.18 * uBackgroundReactivity));
  vec2 bgQ = uvFlow * bgScale;
  float bg1 = fbm(bgQ * (1.0 + uTurbulence * 1.4) + vec2(bgT * 0.45, -bgT * 0.23));
  float bg2 = fbm((bgQ + vec2(4.3, -2.2)) * (1.35 + uTurbulence * 1.9) - vec2(bgT * 0.18, bgT * 0.31));
  float bgFlow = smoothstep(0.1, 0.9, bg1 * 0.85 + bg2 * 0.45 + pulse * (0.08 + 0.12 * uBackgroundReactivity));
  float bgRidge = abs(sin((bg1 * 2.6 + bg2 * 1.3 + bgT * 0.6) * 3.14159));
  float bgSparkle = step(
    1.0 - (0.007 + uParticleDensity * 0.03 * (0.35 + 0.65 * uBackgroundReactivity)),
    hash(floor((uvFlow + bgT * 0.01) * 56.0))
  );
  bgSparkle *= (0.18 + 0.22 * pulse);

  float hueA = fract(uHuePair.x / 360.0 + (uMoodPole * 0.03));
  float hueB = fract(uHuePair.y / 360.0 - (uMoodPole * 0.02));
  float bgHueMix = fract(bgFlow + bg2 * (0.03 + uHueChaos * 0.12) + bgRidge * 0.04);
  float bgHue = mix(hueA, hueB, bgHueMix);
  bgHue = fract(bgHue + (bg1 - 0.5) * uHueChaos * 0.07);
  float bgSat = clamp(uSaturation * 0.78 + bgSparkle * 0.05 + uHueChaos * 0.04, 0.0, 1.0);
  float bgLight = clamp(
    uBrightness * 0.34 +
    bgFlow * 0.19 +
    bgRidge * 0.06 +
    depthField * 0.12 +
    bgSparkle * 0.14 +
    grain * 0.35,
    0.0,
    1.0
  );
  vec3 bgColor = hsl2rgb(vec3(bgHue, bgSat, bgLight));

  // Foreground focal core: soft bloom body + crisp accents, pulse-first response.
  vec2 drift = vec2(
    sin(uTime * 0.19 + uFlowDirection * 0.01),
    cos(uTime * 0.16 + uMoodPole * 1.7)
  ) * vec2(0.075, 0.04) * clamp(uFocalDrift, 0.0, 1.0);
  vec2 focalCenter = vec2(0.0, 0.12) + drift;
  focalCenter.y = clamp(focalCenter.y, 0.04, 0.22);
  focalCenter.x = clamp(focalCenter.x, -0.14 * aspect, 0.14 * aspect);

  vec2 fv = uv - focalCenter;
  vec2 focalUv = rot * fv;

  float focalBaseRadius = mix(0.22, 0.72, clamp(uFocalSize, 0.0, 1.0));
  float pulseAmp = (0.05 + 0.22 * uFocalIntensity) * (0.2 + 0.8 * clamp(uPulseStrength, 0.0, 1.0));
  float focalRadius = focalBaseRadius * (1.0 + pulseAmp * (0.25 + 0.75 * pulse));

  float focalNoiseA = noise(focalUv * (2.2 + uTurbulence * 3.8) + vec2(uTime * 0.22, -uTime * 0.17));
  float focalNoiseB = noise((focalUv + vec2(2.8, -1.4)) * (4.0 + uTurbulence * 5.0) - vec2(uTime * 0.18, uTime * 0.27));
  float focalDeform = (focalNoiseA - 0.5) * (0.04 + uTurbulence * 0.17) + (focalNoiseB - 0.5) * 0.05;

  float focalDist = length(focalUv * vec2(1.0, 1.08)) + focalDeform;
  float coreBody = exp(-pow(focalDist / max(focalRadius, 0.0001), 2.0));
  float halo = exp(-pow(focalDist / max(focalRadius * (1.7 + uBlur * 0.9), 0.0001), 2.2));

  float ridgePhase = focalNoiseB + focalDist * (3.7 + uFocalSharpness * 2.6) - uTime * (0.22 + uWaveSpeed * 0.32);
  float ridge = pow(
    abs(sin(ridgePhase * 6.28318)),
    mix(5.0, 18.0, clamp(uFocalSharpness, 0.0, 1.0))
  );
  float edgeOuter = smoothstep(focalRadius * 1.45, focalRadius * 0.78, focalDist);
  float edgeInner = smoothstep(focalRadius * 0.78, focalRadius * 0.36, focalDist);
  float edgeBand = clamp(edgeOuter - edgeInner, 0.0, 1.0);
  float accent = ridge * edgeBand * (0.08 + 0.62 * uFocalSharpness) * (0.2 + 0.8 * pulse);

  float focalMask = clamp(coreBody * (0.65 + 0.45 * uFocalIntensity) + halo * 0.35, 0.0, 1.0);
  float focalHue = fract(
    mix(hueA, hueB, 0.35 + 0.18 * sin(uTime * 0.05)) +
    (focalNoiseA - 0.5) * uHueChaos * 0.1 +
    pulse * 0.01
  );
  float focalSat = clamp(uSaturation * 0.92 + accent * 0.16 + uFocalSharpness * 0.06, 0.0, 1.0);
  float focalLight = clamp(
    uBrightness * 0.46 +
    halo * 0.24 +
    coreBody * 0.44 +
    accent * 0.5 +
    pulse * 0.06,
    0.0,
    1.0
  );
  vec3 focalColor = hsl2rgb(vec3(focalHue, focalSat, focalLight));
  focalColor += vec3(1.0, 0.98, 1.0) * accent * (0.04 + 0.16 * uFocalSharpness);

  vec3 color = bgColor;
  float focalComposite = clamp(focalMask * (0.35 + 0.75 * uFocalIntensity) + halo * 0.12, 0.0, 1.0);
  color = mix(color, color + focalColor, focalComposite);
  color += focalColor * accent * 0.12;

  float centerGlow = smoothstep(focalRadius * 2.4, 0.0, focalDist) * uBlur * (0.08 + 0.12 * uFocalIntensity);
  color += centerGlow;
  color += grain * 0.12;

  float vignette = smoothstep(1.45, 0.25 + (1.0 - uVignette) * 0.6, length(uv));
  color *= mix(1.0, vignette, clamp(uVignette, 0.0, 1.0));

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
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
  uFocalIntensity: { value: number };
  uFocalSize: { value: number };
  uFocalSharpness: { value: number };
  uFocalDrift: { value: number };
  uBackgroundReactivity: { value: number };
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
    uFocalIntensity: { value: DEFAULT_VISUAL_STATE.focal_intensity },
    uFocalSize: { value: DEFAULT_VISUAL_STATE.focal_size },
    uFocalSharpness: { value: DEFAULT_VISUAL_STATE.focal_sharpness },
    uFocalDrift: { value: DEFAULT_VISUAL_STATE.focal_drift },
    uBackgroundReactivity: { value: DEFAULT_VISUAL_STATE.background_reactivity },
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
  uniforms.uFocalIntensity.value = state.focal_intensity;
  uniforms.uFocalSize.value = state.focal_size;
  uniforms.uFocalSharpness.value = state.focal_sharpness;
  uniforms.uFocalDrift.value = state.focal_drift;
  uniforms.uBackgroundReactivity.value = state.background_reactivity;
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

