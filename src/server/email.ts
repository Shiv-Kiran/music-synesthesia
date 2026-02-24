import { Resend } from "resend";

import { requireEnv } from "@/server/env";

function getResendClient(): Resend {
  const apiKey = requireEnv("RESEND_API_KEY");
  return new Resend(apiKey);
}

export async function sendOwnerWaitlistEmail(params: {
  ownerEmail: string;
  applicantEmail: string;
  applicantName?: string | null;
  approveUrl: string;
  rejectUrl: string;
}): Promise<void> {
  const resend = getResendClient();
  await resend.emails.send({
    from: "Qualia <onboarding@resend.dev>",
    to: params.ownerEmail,
    subject: `Qualia waitlist: ${params.applicantEmail}`,
    html: `
      <p><strong>New waitlist signup</strong></p>
      <p>Email: ${params.applicantEmail}</p>
      ${params.applicantName ? `<p>Name: ${params.applicantName}</p>` : ""}
      <p>
        <a href="${params.approveUrl}">Approve</a> ·
        <a href="${params.rejectUrl}">Reject</a>
      </p>
    `,
  });
}

export async function sendWaitlistWelcomeEmail(params: {
  recipientEmail: string;
  recipientName?: string | null;
}): Promise<void> {
  const resend = getResendClient();
  const firstName = params.recipientName?.trim() || "there";
  await resend.emails.send({
    from: "Shiv from Qualia <onboarding@resend.dev>",
    to: params.recipientEmail,
    subject: "Welcome to Qualia (invite beta)",
    html: `
      <p>Hey ${firstName},</p>
      <p>Thanks for joining the Qualia waitlist.</p>
      <p>I’m Shiv. Appreciate you being early.</p>
      <p>I’ll send invites in small batches. When yours is ready, you’ll get a direct link to jump in and enjoy.</p>
      <p>— Shiv</p>
    `,
  });
}

export async function sendInviteEmail(params: {
  recipientEmail: string;
  inviteUrl: string;
}): Promise<void> {
  const resend = getResendClient();
  await resend.emails.send({
    from: "Qualia <onboarding@resend.dev>",
    to: params.recipientEmail,
    subject: "You're invited to Qualia",
    html: `
      <p>Your invite is ready.</p>
      <p><a href="${params.inviteUrl}">Enter Qualia</a></p>
      <p>If the link doesn’t work, copy and paste it into your browser.</p>
    `,
  });
}
