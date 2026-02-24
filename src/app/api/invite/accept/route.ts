import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/site-url";
import { optionalEnv, requireEnv } from "@/server/env";
import { getSupabaseAdminClient } from "@/server/supabase";
import { hashToken, signToken } from "@/server/tokens";

const COOKIE_NAME = "qualia_beta";

function renderHtml(message: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Qualia</title></head><body style="font-family:Arial,sans-serif;background:#070510;color:#f1eef9;padding:40px;"><h2>${message}</h2></body></html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawToken = searchParams.get("token") ?? "";
  if (!rawToken) {
    return new NextResponse(renderHtml("Missing invite token."), {
      status: 400,
      headers: { "content-type": "text/html" },
    });
  }

  const tokenHash = hashToken(rawToken);
  const supabase = getSupabaseAdminClient();
  const { data: invite } = await supabase
    .from("beta_invites")
    .select("*")
    .eq("invite_token_hash", tokenHash)
    .maybeSingle();

  if (!invite || invite.revoked_at) {
    return new NextResponse(renderHtml("Invite not found."), {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  }

  const now = new Date();
  if (invite.expires_at && new Date(invite.expires_at) < now) {
    return new NextResponse(renderHtml("Invite expired."), {
      status: 410,
      headers: { "content-type": "text/html" },
    });
  }

  if (!invite.used_at) {
    await supabase
      .from("beta_invites")
      .update({ used_at: now.toISOString() })
      .eq("id", invite.id);
  }

  const secret = optionalEnv("BETA_COOKIE_SECRET") ?? requireEnv("ADMIN_ACTION_SECRET");
  const cookieToken = signToken(
    { inviteId: invite.id, email: invite.email },
    secret,
    60 * 60 * 24 * 30,
  );

  const response = NextResponse.redirect(new URL("/session", getSiteUrl()));
  response.cookies.set(COOKIE_NAME, cookieToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
