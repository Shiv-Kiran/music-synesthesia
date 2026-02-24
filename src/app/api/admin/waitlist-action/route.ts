import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/site-url";
import { sendInviteEmail } from "@/server/email";
import { optionalEnv, requireEnv } from "@/server/env";
import { getSupabaseAdminClient } from "@/server/supabase";
import crypto from "crypto";

import { hashToken, verifyToken } from "@/server/tokens";

interface AdminActionPayload extends Record<string, unknown> {
  action?: "approve" | "reject";
  waitlistId?: string;
  email?: string;
}

function renderHtml(message: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Qualia</title></head><body style="font-family:Arial,sans-serif;background:#070510;color:#f1eef9;padding:40px;"><h2>${message}</h2></body></html>`;
}

function renderConfirmHtml(params: {
  token: string;
  action: "approve" | "reject";
  email?: string;
}) {
  const actionLabel = params.action === "approve" ? "Approve" : "Reject";
  const helper =
    params.action === "approve"
      ? "This will approve the waitlist signup and send the invite email."
      : "This will mark the waitlist signup as rejected.";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Qualia ${actionLabel}</title></head><body style="font-family:Arial,sans-serif;background:#070510;color:#f1eef9;padding:40px;"><div style="max-width:560px;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:24px;background:rgba(255,255,255,.04)"><p style="opacity:.75;letter-spacing:.12em;text-transform:uppercase;font-size:12px">Qualia Admin</p><h2 style="margin:8px 0 8px 0">${actionLabel} signup${params.email ? `: ${params.email}` : ""}</h2><p style="opacity:.8">${helper}</p><form method="POST" style="margin-top:20px"><input type="hidden" name="token" value="${params.token}"/><button type="submit" style="border-radius:999px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.08);color:#f1eef9;padding:10px 16px;cursor:pointer">${actionLabel}</button></form></div></body></html>`;
}

function verifyAdminActionToken(token: string) {
  const secret = optionalEnv("ADMIN_ACTION_SECRET") ?? requireEnv("BETA_COOKIE_SECRET");
  return verifyToken<AdminActionPayload>(token, secret);
}

async function executeAdminAction(token: string) {
  const verified = verifyAdminActionToken(token);
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

  if (existingInvite) {
    return new NextResponse(renderHtml("Already approved. Invite was already sent."), {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  const { data: createdInvite, error: inviteInsertError } = await supabase
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

  if (inviteInsertError) {
    return new NextResponse(renderHtml(`Invite creation failed: ${inviteInsertError.message}`), {
      status: 500,
      headers: { "content-type": "text/html" },
    });
  }

  const baseUrl = getSiteUrl();
  const inviteUrl = `${baseUrl}/api/invite/accept?token=${rawToken}`;
  await sendInviteEmail({
    recipientEmail: signup.email,
    inviteUrl,
  });

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

  return new NextResponse(renderHtml("Approved and invite sent."), {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const verified = verifyAdminActionToken(token);
  if (!verified.valid || !verified.payload?.waitlistId || !verified.payload?.action) {
    return new NextResponse(renderHtml("Invalid or expired approval link."), {
      status: 400,
      headers: { "content-type": "text/html" },
    });
  }

  return new NextResponse(
    renderConfirmHtml({
      token,
      action: verified.payload.action,
      email:
        typeof verified.payload.email === "string" ? verified.payload.email : undefined,
    }),
    {
      status: 200,
      headers: { "content-type": "text/html" },
    },
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const tokenValue = formData.get("token");
  const token = typeof tokenValue === "string" ? tokenValue : "";
  return executeAdminAction(token);
}
