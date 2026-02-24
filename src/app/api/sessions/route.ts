import { NextResponse } from "next/server";

import type { SessionFingerprint } from "@/contracts/session";
import { optionalEnv, requireEnv } from "@/server/env";
import { getSupabaseAdminClient } from "@/server/supabase";
import { verifyToken } from "@/server/tokens";

const COOKIE_NAME = "qualia_beta";

function parseDate(value: string): Date | null {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp);
}

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").find((item) => item.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const cookieValue = match.split("=")[1] ?? "";
  const secret = optionalEnv("BETA_COOKIE_SECRET") ?? requireEnv("ADMIN_ACTION_SECRET");
  const verified = verifyToken<{ inviteId: string; email: string }>(cookieValue, secret);
  if (!verified.valid) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    fingerprint?: SessionFingerprint;
    input_mode?: string | null;
    app_version?: string | null;
  };

  if (!payload.fingerprint || !payload.fingerprint.id) {
    return NextResponse.json({ message: "Invalid session." }, { status: 400 });
  }

  const fingerprint = payload.fingerprint;
  const timelineCount = fingerprint.timeline?.length ?? 0;
  const startedAt = parseDate(fingerprint.started_at);
  const endedAt = fingerprint.ended_at ? parseDate(fingerprint.ended_at) : null;
  const lastT = fingerprint.timeline?.at(-1)?.t ?? 0;
  const durationS =
    startedAt && endedAt
      ? Math.max(0.001, (endedAt.getTime() - startedAt.getTime()) / 1000)
      : Math.max(0.001, lastT);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("sessions").upsert(
    {
      client_session_id: fingerprint.id,
      tester_email: verified.payload?.email ?? null,
      input_mode: payload.input_mode ?? null,
      app_version: payload.app_version ?? null,
      fingerprint,
      mode: fingerprint.mode ?? "free",
      timeline_count: timelineCount,
      duration_s: durationS,
      ended_at: endedAt ? endedAt.toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_session_id" },
  );

  if (error) {
    return NextResponse.json({ message: "Failed to save session." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
