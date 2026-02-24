import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/site-url";
import { sendOwnerWaitlistEmail, sendWaitlistWelcomeEmail } from "@/server/email";
import { optionalEnv, requireEnv } from "@/server/env";
import { getSupabaseAdminClient } from "@/server/supabase";
import { signToken } from "@/server/tokens";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; name?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const name = body.name?.trim() ?? null;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { message: "Please provide a valid email." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase
      .from("waitlist_signups")
      .select("id,email,status")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ status: "exists" }, { status: 200 });
    }

    const { data: inserted, error } = await supabase
      .from("waitlist_signups")
      .insert({
        email,
        name,
        status: "pending",
        source: "landing",
      })
      .select()
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { message: "Could not save your signup." },
        { status: 500 },
      );
    }

    const ownerEmail = optionalEnv("OWNER_EMAIL");
    await sendWaitlistWelcomeEmail({
      recipientEmail: email,
      recipientName: name,
    });
    await supabase
      .from("waitlist_signups")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("id", inserted.id);

    if (ownerEmail) {
      const secret = optionalEnv("ADMIN_ACTION_SECRET") ?? requireEnv("BETA_COOKIE_SECRET");
      const baseUrl = getSiteUrl();
      const approveToken = signToken(
        { action: "approve", waitlistId: inserted.id, email },
        secret,
        60 * 60 * 24,
      );
      const rejectToken = signToken(
        { action: "reject", waitlistId: inserted.id, email },
        secret,
        60 * 60 * 24,
      );
      const approveUrl = `${baseUrl}/api/admin/waitlist-action?token=${approveToken}`;
      const rejectUrl = `${baseUrl}/api/admin/waitlist-action?token=${rejectToken}`;
      await sendOwnerWaitlistEmail({
        ownerEmail,
        applicantEmail: email,
        applicantName: name,
        approveUrl,
        rejectUrl,
      });
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save your signup.";
    console.error("waitlist signup error", error);
    return NextResponse.json(
      {
        message:
          process.env.NODE_ENV === "production" ? "Could not save your signup." : message,
      },
      { status: 500 },
    );
  }
}
