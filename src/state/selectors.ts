import type { QualiaStoreState } from "@/state/qualia-store";

export const qualiaSelectors = {
  visualState: (state: QualiaStoreState) => state.visualState,
  targetVisualState: (state: QualiaStoreState) => state.targetVisualState,
  moodPole: (state: QualiaStoreState) => state.targetVisualState.mood_pole,
  huePrimary: (state: QualiaStoreState) => state.targetVisualState.hue_primary,
  hueSecondary: (state: QualiaStoreState) => state.targetVisualState.hue_secondary,
} as const;

