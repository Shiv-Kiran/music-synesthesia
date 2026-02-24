import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/site-url";
import { sendInviteEmail } from "@/server/email";
import { optionalEnv, requireEnv } from "@/server/env";
import { getSupabaseAdminClient } from "@/server/supabase";
import crypto from "crypto";

import { hashToken, verifyToken } from "@/server/tokens";

interface AdminActionPayload {
  action?: "approve" | "reject";
  waitlistId?: string;
  email?: string;
}

function renderHtml(message: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Qualia</title></head><body style="font-family:Arial,sans-serif;background:#070510;color:#f1eef9;padding:40px;"><h2>${message}</h2></body></html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const secret = optionalEnv("ADMIN_ACTION_SECRET") ?? requireEnv("BETA_COOKIE_SECRET");
  const verified = verifyToken<AdminActionPayload>(token, secret);
  if (!verified.valid || !verified.payload?.waitlistId || !verified.payload?.action) {
    return new NextResponse(renderHtml("Invalid or expired approval link."), {
      status: 400,
      headers: { "content-type": "text/html" },
    });
  }

  const supabase = getSupabaseAdminClient();
  const waitlistId = verified.payload.waitlistId;
  const action = verified.payload.action;
  const { data: signup } = await supabase
    .from("waitlist_signups")
    .select("*")
    .eq("id", waitlistId)
    .maybeSingle();

  if (!signup) {
    return new NextResponse(renderHtml("Waitlist entry not found."), {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  }

  if (action === "reject") {
    await supabase
      .from("waitlist_signups")
      .update({ status: "rejected" })
      .eq("id", waitlistId);
    return new NextResponse(renderHtml("Rejected."), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }

  if (signup.status !== "approved") {
    await supabase
      .from("waitlist_signups")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_email: optionalEnv("OWNER_EMAIL") ?? "owner",
      })
      .eq("id", waitlistId);
  }

  const { data: existingInvite } = await supabase
    .from("beta_invites")
    .select("*")
    .eq("waitlist_signup_id", waitlistId)
    .maybeSingle();

  if (!existingInvite) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

    const { data: createdInvite } = await supabase
      .from("beta_invites")
      .insert({
        waitlist_signup_id: waitlistId,
        email: signup.email,
        invite_token_hash: tokenHash,
        expires_at: expiresAt,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    const baseUrl = getSiteUrl();
    const inviteUrl = `${baseUrl}/api/invite/accept?token=${rawToken}`;
    try {
      await sendInviteEmail({
        recipientEmail: signup.email,
        inviteUrl,
      });
    } catch {
      // non-blocking: invite exists even if email fails
    }

    await supabase
      .from("waitlist_signups")
      .update({ invite_sent_at: new Date().toISOString() })
      .eq("id", waitlistId);

    if (!createdInvite) {
      return new NextResponse(renderHtml("Invite created, email queued."), {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
  }

  return new NextResponse(renderHtml("Approved and invite sent."), {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}
