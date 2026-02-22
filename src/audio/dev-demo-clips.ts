export interface DevDemoAudioClip {
  id: string;
  href: string;
  label: string;
  synthetic_start_s: number;
  duration_s: number;
}

export const DEV_DEMO_AUDIO_CLIPS: DevDemoAudioClip[] = [
  {
    id: "kick-grid-16s",
    href: "/dev-audio/qualia-demo-kick-grid-16s.wav",
    label: "kick grid (16s)",
    synthetic_start_s: 0,
    duration_s: 16,
  },
  {
    id: "transient-snap-16s",
    href: "/dev-audio/qualia-demo-transient-snap-16s.wav",
    label: "transient snap (16s)",
    synthetic_start_s: 0,
    duration_s: 16,
  },
  {
    id: "broken-beat-16s",
    href: "/dev-audio/qualia-demo-broken-beat-16s.wav",
    label: "broken beat (16s)",
    synthetic_start_s: 0,
    duration_s: 16,
  },
  {
    id: "tom-rush-16s",
    href: "/dev-audio/qualia-demo-tom-rush-16s.wav",
    label: "tom rush (16s)",
    synthetic_start_s: 0,
    duration_s: 16,
  },
  {
    id: "peaceful-drift-16s",
    href: "/dev-audio/qualia-demo-peaceful-drift-16s.wav",
    label: "peaceful drift (16s)",
    synthetic_start_s: 0,
    duration_s: 16,
  },
  {
    id: "peaceful-glass-16s",
    href: "/dev-audio/qualia-demo-peaceful-glass-16s.wav",
    label: "peaceful glass (16s)",
    synthetic_start_s: 0,
    duration_s: 16,
  },
];

export function getDevDemoAudioClipById(id: string): DevDemoAudioClip | null {
  return DEV_DEMO_AUDIO_CLIPS.find((clip) => clip.id === id) ?? null;
}

