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
];

export function getDevDemoAudioClipById(id: string): DevDemoAudioClip | null {
  return DEV_DEMO_AUDIO_CLIPS.find((clip) => clip.id === id) ?? null;
}

