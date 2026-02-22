export interface DevDemoAudioClip {
  id: string;
  href: string;
  label: string;
  synthetic_start_s: number;
  duration_s: number;
}

export const DEV_DEMO_AUDIO_CLIPS: DevDemoAudioClip[] = [
  {
    id: "steady-pulse-16s",
    href: "/dev-audio/qualia-demo-steady-pulse-16s.wav",
    label: "steady pulse (16s)",
    synthetic_start_s: 0,
    duration_s: 16,
  },
  {
    id: "halftime-thump-16s",
    href: "/dev-audio/qualia-demo-halftime-thump-16s.wav",
    label: "halftime thump (16s)",
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
    id: "neon-arp-16s",
    href: "/dev-audio/qualia-demo-neon-arp-16s.wav",
    label: "neon arp (16s)",
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

