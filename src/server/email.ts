import { Resend } from "resend";

import { optionalEnv, requireEnv } from "@/server/env";

function getResendClient(): Resend {
  const apiKey = requireEnv("RESEND_API_KEY");
  return new Resend(apiKey);
}

function getFromAddress(displayName: string): string {
  const fromEmail = optionalEnv("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  return `${displayName} <${fromEmail}>`;
}

async function sendEmailOrThrow(params: Parameters<Resend["emails"]["send"]>[0]) {
  const resend = getResendClient();
  const result = await resend.emails.send(params);

  if ("error" in result && result.error) {
    throw new Error(
      typeof result.error.message === "string"
        ? result.error.message
        : "Resend email send failed.",
    );
  }

  if (process.env.NODE_ENV !== "production" && "data" in result && result.data?.id) {
    console.log("resend email sent", {
      id: result.data.id,
      to: params.to,
      subject: params.subject,
    });
  }

  return result;
}

export async function sendOwnerWaitlistEmail(params: {
  ownerEmail: string;
  applicantEmail: string;
  applicantName?: string | null;
  approveUrl: string;
  rejectUrl: string;
}): Promise<void> {
  await sendEmailOrThrow({
    from: getFromAddress("Qualia"),
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
  const firstName = params.recipientName?.trim() || "there";
  await sendEmailOrThrow({
    from: getFromAddress("Shiv from Qualia"),
    to: params.recipientEmail,
    subject: "you're on the list. Qualia",
    html: `
      <p>hey ${firstName},</p>
      <p>you're on the list.</p>
      <p>i'm shiv. i'm building qualia for people who feel music differently. you're one of them.</p>
      <p>invites go out slowly, on purpose. when yours is ready — you'll know.</p>
      <p>— shiv</p>
    `,
  });
}

export async function sendInviteEmail(params: {
  recipientEmail: string;
  inviteUrl: string;
}): Promise<void> {
  await sendEmailOrThrow({
    from: getFromAddress("Qualia"),
    to: params.recipientEmail,
    subject: "it's time.",
    html: `
      <p>you're in.</p>
      <p>feel the music</p>
      <p><a href="${params.inviteUrl}">enter qualia</a></p>
    `,
  });
}