import type { AudioFeatures } from "@/contracts/audio";
import type { PromptPhase } from "@/contracts/prompt";
import type {
  SessionFingerprint,
  SnapshotEvent,
  SnapshotTrigger,
} from "@/contracts/session";
import type { VisualState, VisualStateParams } from "@/contracts/visual-state";
import { normalizeVisualState } from "@/contracts/normalize";

type CompactAudioSnapshot = SnapshotEvent["audio_snapshot"];

const VISUAL_PARAM_KEYS: Array<keyof VisualStateParams> = [
  "hue_primary",
  "hue_secondary",
  "saturation",
  "brightness",
  "hue_chaos",
  "mood_pole",
  "turbulence",
  "wave_speed",
  "particle_density",
  "flow_direction",
  "pulse_strength",
  "depth",
  "scale",
  "blur",
  "vignette",
];

const WRAPPED_VISUAL_KEYS = new Set<keyof VisualStateParams>([
  "hue_primary",
  "hue_secondary",
  "flow_direction",
]);

export interface RecorderPromptMeta {
  prompt_phase?: PromptPhase;
  prompt_text?: string;
  user_response?: string;
  response_latency_ms?: number;
}

export interface RecorderSnapshotInput {
  trigger: SnapshotTrigger;
  visual_state: VisualState;
  audio_features?: AudioFeatures;
  audio_snapshot?: CompactAudioSnapshot;
  prompt?: RecorderPromptMeta;
  lastKnownPromptPhase?: PromptPhase | null;
  nowEpochMs?: number;
}

export interface SessionRecorderStartParams {
  initial_preset: VisualState;
  nowEpochMs?: number;
}

export interface SessionRecorderResumeParams {
  nowEpochMs?: number;
}

export interface SessionRecorderEndParams {
  nowEpochMs?: number;
}

export interface SessionRecorder {
  startNew: (params: SessionRecorderStartParams) => SessionFingerprint;
  resumeDraft: (
    draft: SessionFingerprint,
    params?: SessionRecorderResumeParams,
  ) => SessionFingerprint;
  isActive: () => boolean;
  getDraft: () => SessionFingerprint | null;
  recordSnapshot: (input: RecorderSnapshotInput) => SnapshotEvent | null;
  end: (params?: SessionRecorderEndParams) => SessionFingerprint | null;
  clear: () => void;
}

function nowEpochMs(): number {
  return Date.now();
}

function toIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function parseIsoMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function generateSessionId(epochMs: number): string {
  return `qualia_${epochMs}_${randomSuffix()}`;
}

function cloneAudioSnapshot(snapshot: CompactAudioSnapshot): CompactAudioSnapshot {
  return {
    rms: snapshot.rms,
    bass_energy: snapshot.bass_energy,
    mid_energy: snapshot.mid_energy,
    high_energy: snapshot.high_energy,
    spectral_centroid: snapshot.spectral_centroid,
    zero_crossing_rate: snapshot.zero_crossing_rate,
    ...(typeof snapshot.bpm === "number" ? { bpm: snapshot.bpm } : {}),
  };
}

function cloneSnapshotEvent(event: SnapshotEvent): SnapshotEvent {
  return {
    t: event.t,
    trigger: event.trigger,
    prompt_phase: event.prompt_phase,
    prompt_text: event.prompt_text,
    user_response: event.user_response,
    response_latency_ms: event.response_latency_ms,
    visual_state: normalizeVisualState(event.visual_state, event.visual_state._timestamp),
    audio_snapshot: cloneAudioSnapshot(event.audio_snapshot),
  };
}

function cloneSessionFingerprint(session: SessionFingerprint): SessionFingerprint {
  return {
    ...session,
    timeline: session.timeline.map(cloneSnapshotEvent),
    initial_preset: normalizeVisualState(
      session.initial_preset,
      session.initial_preset._timestamp,
    ),
    dominant_state: normalizeVisualState(
      session.dominant_state,
      session.dominant_state._timestamp,
    ),
    ...(session.music_context
      ? {
          music_context: {
            ...session.music_context,
            ...(session.music_context.songs_identified
              ? {
                  songs_identified: session.music_context.songs_identified.map((song) => ({
                    ...song,
                  })),
                }
              : {}),
            ...(session.music_context.genre_hints
              ? { genre_hints: [...session.music_context.genre_hints] }
              : {}),
          },
        }
      : {}),
    ...(session.vibe_summary
      ? {
          vibe_summary: {
            ...session.vibe_summary,
            palette: [...session.vibe_summary.palette],
            tags: [...session.vibe_summary.tags],
            intensity_curve: [...session.vibe_summary.intensity_curve],
          },
        }
      : {}),
  };
}

function buildAudioSnapshot(
  audioFeatures?: AudioFeatures,
  audioSnapshot?: CompactAudioSnapshot,
): CompactAudioSnapshot {
  if (audioSnapshot) {
    return cloneAudioSnapshot(audioSnapshot);
  }

  return {
    rms: audioFeatures?.rms ?? 0,
    bass_energy: audioFeatures?.bass_energy ?? 0,
    mid_energy: audioFeatures?.mid_energy ?? 0,
    high_energy: audioFeatures?.high_energy ?? 0,
    spectral_centroid: audioFeatures?.spectral_centroid ?? 0,
    zero_crossing_rate: audioFeatures?.zero_crossing_rate ?? 0,
    ...(typeof audioFeatures?.bpm_estimate === "number"
      ? { bpm: audioFeatures.bpm_estimate }
      : {}),
  };
}

function getSessionElapsedMs(startedAtIso: string, epochMs: number): number {
  const startedAtMs = parseIsoMs(startedAtIso);
  if (startedAtMs === null) {
    return 0;
  }
  return Math.max(0, Math.trunc(epochMs - startedAtMs));
}

function getDerivedSessionDurationMs(
  session: SessionFingerprint,
  fallbackNowEpochMs: number,
): number {
  const startedAtMs = parseIsoMs(session.started_at);
  const endedAtMs = session.ended_at ? parseIsoMs(session.ended_at) : null;
  const lastEventT = session.timeline.at(-1)?.t ?? 0;

  if (startedAtMs === null) {
    return Math.max(lastEventT, 1);
  }

  const referenceEndMs = endedAtMs ?? fallbackNowEpochMs;
  return Math.max(lastEventT, Math.trunc(referenceEndMs - startedAtMs), 1);
}

function circularWeightedMean(values: Array<{ value: number; weight: number }>): number {
  let x = 0;
  let y = 0;
  let totalWeight = 0;

  for (const item of values) {
    const weight = Math.max(0, item.weight);
    if (weight <= 0) {
      continue;
    }
    const radians = (item.value * Math.PI) / 180;
    x += Math.cos(radians) * weight;
    y += Math.sin(radians) * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0 || (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9)) {
    return 0;
  }

  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
}

function linearWeightedMean(values: Array<{ value: number; weight: number }>): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of values) {
    const weight = Math.max(0, item.weight);
    if (weight <= 0) {
      continue;
    }
    weightedSum += item.value * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return 0;
  }

  return weightedSum / totalWeight;
}

function deriveDominantState(
  session: SessionFingerprint,
  fallbackNowEpochMs = nowEpochMs(),
): VisualState {
  if (session.timeline.length === 0) {
    return normalizeVisualState(session.initial_preset, session.initial_preset._timestamp);
  }

  if (session.timeline.length === 1) {
    const only = session.timeline[0];
    return normalizeVisualState(only.visual_state, only.visual_state._timestamp);
  }

  const sortedTimeline = [...session.timeline].sort((a, b) => a.t - b.t);
  const sessionDurationMs = getDerivedSessionDurationMs(session, fallbackNowEpochMs);
  const latestEvent = sortedTimeline[sortedTimeline.length - 1];

  const weightsByIndex = sortedTimeline.map((event, index) => {
    const nextT = sortedTimeline[index + 1]?.t ?? sessionDurationMs;
    const duration = Math.max(1, nextT - event.t);
    return duration;
  });

  const nextState: Partial<VisualState> = {
    _version: latestEvent.visual_state._version,
    _timestamp: latestEvent.visual_state._timestamp,
  };

  for (const key of VISUAL_PARAM_KEYS) {
    const values = sortedTimeline.map((event, index) => ({
      value: event.visual_state[key],
      weight: weightsByIndex[index] ?? 1,
    }));
    nextState[key] = WRAPPED_VISUAL_KEYS.has(key)
      ? circularWeightedMean(values)
      : linearWeightedMean(values);
  }

  return normalizeVisualState(nextState, latestEvent.visual_state._timestamp);
}

function getLastKnownPromptPhaseFromTimeline(
  session: SessionFingerprint,
): PromptPhase | null {
  return session.timeline.at(-1)?.prompt_phase ?? null;
}

export function createSessionRecorder(): SessionRecorder {
  let activeDraft: SessionFingerprint | null = null;
  let lastKnownPromptPhase: PromptPhase | null = null;

  const recalcDominantState = (referenceNowMs: number) => {
    if (!activeDraft) {
      return;
    }
    activeDraft.dominant_state = deriveDominantState(activeDraft, referenceNowMs);
  };

  return {
    startNew: ({ initial_preset, nowEpochMs: inputNowEpochMs }) => {
      const startedEpochMs = inputNowEpochMs ?? nowEpochMs();
      const normalizedInitialPreset = normalizeVisualState(initial_preset, startedEpochMs);
      activeDraft = {
        id: generateSessionId(startedEpochMs),
        started_at: toIso(startedEpochMs),
        ended_at: "",
        mode: "free",
        timeline: [],
        initial_preset: normalizedInitialPreset,
        dominant_state: normalizedInitialPreset,
      };
      lastKnownPromptPhase = null;
      return cloneSessionFingerprint(activeDraft);
    },

    resumeDraft: (draft, params) => {
      activeDraft = cloneSessionFingerprint(draft);
      lastKnownPromptPhase = getLastKnownPromptPhaseFromTimeline(activeDraft);
      recalcDominantState(params?.nowEpochMs ?? nowEpochMs());
      return cloneSessionFingerprint(activeDraft);
    },

    isActive: () => Boolean(activeDraft && activeDraft.ended_at === ""),

    getDraft: () => (activeDraft ? cloneSessionFingerprint(activeDraft) : null),

    recordSnapshot: (input) => {
      if (!activeDraft || activeDraft.ended_at !== "") {
        return null;
      }

      const epochMs = input.nowEpochMs ?? nowEpochMs();
      const baseT = getSessionElapsedMs(activeDraft.started_at, epochMs);
      const previousT = activeDraft.timeline.at(-1)?.t ?? 0;
      const t = Math.max(baseT, previousT);

      const promptPhase =
        input.prompt?.prompt_phase ?? input.lastKnownPromptPhase ?? lastKnownPromptPhase ?? "grounding";

      const snapshot: SnapshotEvent = {
        t,
        trigger: input.trigger,
        prompt_phase: promptPhase,
        prompt_text: input.prompt?.prompt_text ?? "",
        user_response: input.prompt?.user_response ?? "",
        response_latency_ms: Math.max(0, Math.trunc(input.prompt?.response_latency_ms ?? 0)),
        visual_state: normalizeVisualState(input.visual_state, input.visual_state._timestamp),
        audio_snapshot: buildAudioSnapshot(input.audio_features, input.audio_snapshot),
      };

      activeDraft.timeline.push(snapshot);
      lastKnownPromptPhase = snapshot.prompt_phase;
      recalcDominantState(epochMs);
      return cloneSnapshotEvent(snapshot);
    },

    end: (params) => {
      if (!activeDraft || activeDraft.ended_at !== "") {
        return activeDraft ? cloneSessionFingerprint(activeDraft) : null;
      }

      const endedEpochMs = params?.nowEpochMs ?? nowEpochMs();
      activeDraft.ended_at = toIso(endedEpochMs);
      recalcDominantState(endedEpochMs);
      return cloneSessionFingerprint(activeDraft);
    },

    clear: () => {
      activeDraft = null;
      lastKnownPromptPhase = null;
    },
  };
}

