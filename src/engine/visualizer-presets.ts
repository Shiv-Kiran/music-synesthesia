export type VisualizerPresetId =
  | "organic_presence"
  | "monochrome_concentric_emergence";

export interface VisualizerPresetDefinition {
  id: VisualizerPresetId;
  label: string;
  description: string;
}

export const DEFAULT_VISUALIZER_PRESET: VisualizerPresetId = "organic_presence";

export const VISUALIZER_PRESETS: VisualizerPresetDefinition[] = [
  {
    id: "organic_presence",
    label: "organic presence",
    description:
      "Soft amorphous center with beat surge/recoil and subtle psychedelic ripple accents.",
  },
  {
    id: "monochrome_concentric_emergence",
    label: "neutral emergence",
    description:
      "High-contrast concentric monochrome ripples with a white core pop and delayed color emergence.",
  },
] as const;

export function isVisualizerPresetId(value: string): value is VisualizerPresetId {
  return VISUALIZER_PRESETS.some((preset) => preset.id === value);
}
