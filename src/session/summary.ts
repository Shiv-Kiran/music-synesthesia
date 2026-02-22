import type { SessionFingerprint } from "@/contracts/session";

export function canBuildLocalSessionSummary(session: SessionFingerprint): boolean {
  return session.ended_at !== "" && session.timeline.length > 0;
}

export function buildLocalSessionSummary(
  session: SessionFingerprint,
): SessionFingerprint["vibe_summary"] | undefined {
  void session;
  return undefined;
}
