import type { AudioFeatures } from "@/contracts/audio";
import type { PromptPhase } from "@/contracts/prompt";
import type { VisualState } from "@/contracts/visual-state";

export type SnapshotTrigger =
  | "time"
  | "energy_spike"
  | "drop"
  | "bpm_shift"
  | "user_initiated";

export interface SnapshotEvent {
  t: number;
  trigger: SnapshotTrigger;
  prompt_phase: PromptPhase;
  prompt_text: string;
  user_response: string;
  response_latency_ms: number;
  visual_state: VisualState;
  audio_snapshot: Pick<
    AudioFeatures,
    | "rms"
    | "bass_energy"
    | "mid_energy"
    | "high_energy"
    | "spectral_centroid"
    | "zero_crossing_rate"
  > & { bpm?: number };
}

export interface SessionFingerprint {
  id: string;
  started_at: string;
  ended_at: string;
  mode: "free" | "song";
  music_context?: {
    songs_identified?: Array<{
      t: number;
      title?: string;
      artist?: string;
      confidence?: number;
    }>;
    genre_hints?: string[];
    avg_bpm?: number;
    energy_profile?: "low" | "medium" | "high" | "variable";
  };
  timeline: SnapshotEvent[];
  vibe_summary?: {
    description: string;
    palette: string[];
    tags: string[];
    intensity_curve: number[];
  };
  initial_preset: VisualState;
  dominant_state: VisualState;
}

export interface UserFingerprint {
  preferred_mood_pole: number;
  dominant_hue_range: [number, number];
  texture_preference: string[];
  space_preference: string[];
  typical_session_length: number;
  peak_listen_time?: string;
  saved_presets: Array<{ name: string; state: VisualState }>;
}

