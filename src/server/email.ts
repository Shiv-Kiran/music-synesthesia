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
  const subject = `Qualia waitlist: ${params.applicantEmail}`;
  await resend.emails.send({
    from: "Qualia <onboarding@resend.dev>",
    to: params.ownerEmail,
    subject,
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

export async function sendInviteEmail(params: {
  recipientEmail: string;
  inviteUrl: string;
}): Promise<void> {
  const resend = getResendClient();
  await resend.emails.send({
    from: "Qualia <onboarding@resend.dev>",
    to: params.recipientEmail,
    subject: "You’re invited to Qualia",
    html: `
      <p>Your invite is ready.</p>
      <p><a href="${params.inviteUrl}">Enter Qualia</a></p>
      <p>If the link doesn’t work, copy and paste it into your browser.</p>
    `,
  });
}
