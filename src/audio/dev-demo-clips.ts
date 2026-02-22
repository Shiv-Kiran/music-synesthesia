export interface DevDemoAudioClip {
  id: string;
  href: string;
  label: string;
  synthetic_start_s: number;
  duration_s: number;
}

export const DEV_DEMO_AUDIO_CLIPS: DevDemoAudioClip[] = [
  {
    id: "loop-24s",
    href: "/dev-audio/qualia-demo-loop-24s.wav",
    label: "full loop (24s)",
    synthetic_start_s: 0,
    duration_s: 24,
  },
  {
    id: "build-0-10s",
    href: "/dev-audio/qualia-demo-build-0-10s.wav",
    label: "build (0-10s)",
    synthetic_start_s: 0,
    duration_s: 10,
  },
  {
    id: "peak-10-14s",
    href: "/dev-audio/qualia-demo-peak-10-14s.wav",
    label: "peak (10-14s)",
    synthetic_start_s: 10,
    duration_s: 4,
  },
  {
    id: "drop-14-18s",
    href: "/dev-audio/qualia-demo-drop-14-18s.wav",
    label: "drop (14-18s)",
    synthetic_start_s: 14,
    duration_s: 4,
  },
  {
    id: "accents-20-24s",
    href: "/dev-audio/qualia-demo-accents-20-24s.wav",
    label: "accents (20-24s)",
    synthetic_start_s: 20,
    duration_s: 4,
  },
];

export function getDevDemoAudioClipById(id: string): DevDemoAudioClip | null {
  return DEV_DEMO_AUDIO_CLIPS.find((clip) => clip.id === id) ?? null;
}

