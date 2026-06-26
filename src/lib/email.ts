import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { getAppUrl } from "./env";

/** Fail fast if SMTP is slow or misconfigured — never block register for minutes. */
export const SMTP_TIMEOUT_MS = 12_000;

const RENDER_SMTP_BLOCKED_HINT =
  "Render free tier blocks outbound SMTP (ports 25/465/587). Use RESEND_API_KEY or BREVO_API_KEY on Render, or upgrade to a paid Render instance.";

function smtpUser(): string {
  return process.env.SMTP_USER?.trim().replace(/^["']|["']$/g, "") ?? "";
}

function smtpPassword(): string {
  return process.env.SMTP_PASS?.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "") ?? "";
}

function resendApiKey(): string {
  return process.env.RESEND_API_KEY?.trim().replace(/^["']|["']$/g, "") ?? "";
}

function brevoApiKey(): string {
  return process.env.BREVO_API_KEY?.trim().replace(/^["']|["']$/g, "") ?? "";
}

export type EmailProvider = "resend" | "brevo" | "smtp" | "none";

export function getActiveEmailProvider(): EmailProvider {
  if (resendApiKey()) return "resend";
  if (brevoApiKey()) return "brevo";
  if (process.env.SMTP_HOST?.trim() && smtpUser() && smtpPassword()) return "smtp";
  return "none";
}

function defaultFromAddress() {
  const user = smtpUser();
  const custom = process.env.SMTP_FROM?.trim().replace(/^["']|["']$/g, "");
  if (custom) return custom;
  if (user) return `"TechFlare Solutions" <${user}>`;
  return `"TechFlare Solutions" <noreply@techflaresolutions.com>`;
}

/** Gmail SMTP requires From to match the authenticated account. */
function smtpFromAddress() {
  const user = smtpUser();
  const custom = process.env.SMTP_FROM?.trim().replace(/^["']|["']$/g, "");
  if (custom && user && custom.toLowerCase().includes(user.toLowerCase())) {
    return custom;
  }
  return defaultFromAddress();
}

function resendFromAddress() {
  return (
    process.env.RESEND_FROM?.trim().replace(/^["']|["']$/g, "") ||
    process.env.SMTP_FROM?.trim().replace(/^["']|["']$/g, "") ||
    "TechFlare Solutions <noreply@techflare-solutions.com>"
  );
}

function resendReplyTo(): string | undefined {
  const reply =
    process.env.RESEND_REPLY_TO?.trim().replace(/^["']|["']$/g, "") ||
    process.env.SMTP_USER?.trim().replace(/^["']|["']$/g, "");
  return reply || undefined;
}

function brevoSender() {
  const from = process.env.BREVO_SENDER_EMAIL?.trim() || smtpUser() || "stechflare@gmail.com";
  const name =
    process.env.BREVO_SENDER_NAME?.trim() ||
    process.env.SMTP_FROM?.match(/^([^<]+)/)?.[1]?.trim() ||
    "TechFlare Solutions";
  return { email: from.replace(/^["']|["']$/g, ""), name };
}

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = smtpUser();
  const pass = smtpPassword();

  if (!host || !user || !pass) {
    return null;
  }

  const options: SMTPTransport.Options = {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  };

  return nodemailer.createTransport(options);
}

async function sendMailWithTimeout(
  transport: nodemailer.Transporter,
  mail: MailPayload,
  attachments?: EmailAttachment[]
) {
  await Promise.race([
    transport.sendMail({
      from: smtpFromAddress(),
      ...mail,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        cid: a.cid,
      })),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`SMTP timed out after ${SMTP_TIMEOUT_MS}ms`)), SMTP_TIMEOUT_MS)
    ),
  ]);
}

type MailPayload = { to: string; subject: string; html: string; text: string };

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string;
};

async function sendViaResend(mail: MailPayload, attachments?: EmailAttachment[]) {
  const apiKey = resendApiKey();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromAddress(),
      reply_to: resendReplyTo(),
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
        content_id: a.cid,
      })),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string; id?: string };
  if (!response.ok) {
    throw new Error(payload.message || `Resend API error (${response.status})`);
  }
  return { ok: true as const, provider: "resend" as const, id: payload.id };
}

async function sendViaBrevo(mail: MailPayload, attachments?: EmailAttachment[]) {
  const apiKey = brevoApiKey();
  const sender = brevoSender();
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
      attachment: attachments?.map((a) => ({
        name: a.filename,
        content: a.content.toString("base64"),
      })),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) {
    throw new Error(payload.message || payload.code || `Brevo API error (${response.status})`);
  }
  return { ok: true as const, provider: "brevo" as const };
}

export async function verifyEmailDelivery(): Promise<{ ok: boolean; provider?: EmailProvider; error?: string }> {
  const provider = getActiveEmailProvider();
  if (provider === "none") {
    return { ok: false, provider, error: "No email provider configured" };
  }
  if (provider === "resend" || provider === "brevo") {
    return { ok: true, provider };
  }

  const transport = getTransport();
  if (!transport) {
    return { ok: false, provider, error: "SMTP_HOST, SMTP_USER, or SMTP_PASS not set" };
  }
  try {
    await Promise.race([
      transport.verify(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`SMTP verify timed out after ${SMTP_TIMEOUT_MS}ms`)), SMTP_TIMEOUT_MS)
      ),
    ]);
    return { ok: true, provider };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP verify failed";
    const renderBlocked = /timed out|ETIMEDOUT|ECONNREFUSED|Network is unreachable/i.test(message);
    return {
      ok: false,
      provider,
      error: renderBlocked ? `${message}. ${RENDER_SMTP_BLOCKED_HINT}` : message,
    };
  }
}

/** @deprecated Use verifyEmailDelivery */
export const verifySmtpConnection = verifyEmailDelivery;

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const provider = getActiveEmailProvider();
  const mail = { to, subject, html, text };

  if (provider === "resend") {
    return sendViaResend(mail);
  }
  if (provider === "brevo") {
    return sendViaBrevo(mail);
  }

  const transport = getTransport();
  if (!transport) {
    const missing = [
      !resendApiKey() && !brevoApiKey() && !process.env.SMTP_HOST?.trim() && "RESEND_API_KEY or SMTP_HOST",
      !resendApiKey() && !brevoApiKey() && !smtpUser() && "SMTP_USER",
      !resendApiKey() && !brevoApiKey() && !smtpPassword() && "SMTP_PASS",
    ].filter(Boolean);

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Email not configured on server. Set RESEND_API_KEY (recommended on Render free tier) or ${missing.join(", ")}.`
      );
    }

    console.log("[email:dev-fallback]", { to, subject, text });
    return { ok: true, dev: true as const, provider: "none" as const };
  }

  try {
    await sendMailWithTimeout(transport, mail);
    return { ok: true, dev: false as const, provider: "smtp" as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP send failed";
    if (/timed out|ETIMEDOUT|ECONNREFUSED|Network is unreachable/i.test(message)) {
      throw new Error(`${message}. ${RENDER_SMTP_BLOCKED_HINT}`);
    }
    throw err;
  }
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: EmailAttachment[]
) {
  const provider = getActiveEmailProvider();
  const mail = { to, subject, html, text };

  if (provider === "resend") {
    return sendViaResend(mail, attachments);
  }
  if (provider === "brevo") {
    return sendViaBrevo(mail, attachments);
  }

  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email not configured — cannot send invoice with QR attachment.");
    }
    console.log("[email:dev-fallback-with-attachment]", { to, subject, attachments: attachments.length });
    return { ok: true, dev: true as const, provider: "none" as const };
  }

  await sendMailWithTimeout(transport, mail, attachments);
  return { ok: true, dev: false as const, provider: "smtp" as const };
}

export function getEmailConfigStatus() {
  const provider = getActiveEmailProvider();
  const configured = provider !== "none";

  return {
    configured,
    provider,
    resend: Boolean(resendApiKey()),
    brevo: Boolean(brevoApiKey()),
    host: Boolean(process.env.SMTP_HOST?.trim()),
    user: Boolean(smtpUser()),
    pass: Boolean(smtpPassword()),
    from: Boolean(process.env.SMTP_FROM?.trim() || process.env.RESEND_FROM?.trim() || smtpUser()),
    smtpTimeoutMs: SMTP_TIMEOUT_MS,
    fromAddress: provider === "resend" ? resendFromAddress() : provider === "brevo" ? brevoSender().email : smtpFromAddress(),
    hint: configured
      ? provider === "smtp"
        ? `SMTP is set but may not work on Render free tier. ${RENDER_SMTP_BLOCKED_HINT}`
        : `${provider} API is configured for outbound email.`
      : `Set RESEND_API_KEY on Render (free tier blocks Gmail SMTP). ${RENDER_SMTP_BLOCKED_HINT}`,
  };
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  code: string,
  token: string
) {
  const verifyUrl = `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const appUrl = getAppUrl();
  const subject = "Welcome to TechFlare Solutions — verify your email";
  const text = `Hi ${name},

Thank you for joining TechFlare Solutions!

We're glad to have you on board. To activate your account and access your client or innovator portal, please verify your email address using the code below.

Your verification code: ${code}

Or verify in one click: ${verifyUrl}

This code expires in 24 hours. If you did not create an account with us, you can safely ignore this email.

Once verified, you can sign in, explore our services, submit ideas, and manage your projects from your personal portal.

Welcome aboard,
TechFlare Solutions Team
${appUrl}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#0a0f1a;color:#e8e8e8;padding:32px 24px;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <p style="margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#d4af37">TechFlare Solutions</p>
        <h1 style="margin:12px 0 0;font-size:24px;color:#ffffff;font-weight:700">Welcome — thanks for joining us!</h1>
      </div>

      <p style="font-size:16px;line-height:1.6;margin:0 0 16px">Hi ${name},</p>

      <p style="font-size:15px;line-height:1.7;margin:0 0 16px;color:#c8c8c8">
        Thank you for creating an account with <strong style="color:#fff">TechFlare Solutions</strong>.
        We're excited to have you as part of our community of clients and innovators.
      </p>

      <p style="font-size:15px;line-height:1.7;margin:0 0 20px;color:#c8c8c8">
        To complete your registration and unlock your portal, please verify your email address.
        Enter the 6-digit code below on our verification page, or use the button to verify instantly.
      </p>

      <div style="background:#111827;border:1px solid #d4af3740;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
        <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Your verification code</p>
        <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:#d4af37">${code}</p>
        <p style="margin:12px 0 0;font-size:12px;color:#6b7280">Expires in 24 hours</p>
      </div>

      <div style="text-align:center;margin:0 0 28px">
        <a href="${verifyUrl}" style="background:#d4af37;color:#000;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:15px">Verify my email</a>
      </div>

      <p style="font-size:14px;line-height:1.6;margin:0 0 12px;color:#9ca3af">
        <strong style="color:#d4af37">What happens next?</strong><br/>
        After verification you can sign in, browse solutions, submit project requests, track workflows, and use your personalised portal.
      </p>

      <p style="font-size:13px;line-height:1.6;margin:0 0 24px;color:#6b7280">
        If you didn't sign up for TechFlare Solutions, please ignore this message — no action is needed.
      </p>

      <hr style="border:none;border-top:1px solid #1f2937;margin:24px 0" />

      <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;line-height:1.6">
        TechFlare Solutions<br/>
        <span style="color:#d4af37;font-size:11px;letter-spacing:1px">IGNITING INNOVATIONS, DELIVERING SOLUTIONS</span><br/>
        <a href="${appUrl}" style="color:#d4af37;text-decoration:none">${appUrl.replace(/^https?:\/\//, "")}</a>
      </p>
    </div>`;
  return sendEmail(to, subject, html, text);
}

export async function trySendVerificationEmail(
  to: string,
  name: string,
  code: string,
  token: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    const result = await sendVerificationEmail(to, name, code, token);
    if ("dev" in result && result.dev) {
      console.log(`[email] dev mode — OTP for ${to}: ${code}`);
      return { sent: false, error: "SMTP not configured (dev mode)" };
    }
    console.log(`[email] verification sent to ${to} via ${result.provider}`);
    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to send email";
    console.error(`[email] verification failed for ${to}:`, error);
    return { sent: false, error };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  code: string,
  token: string
) {
  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your TechFlare Solutions password";
  const text = `Hi ${name},\n\nReset code: ${code}\n\nReset here: ${resetUrl}\n\nExpires in 1 hour.\n\n— TechFlare Solutions`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#d4af37">Password reset</h2>
      <p>Hi ${name},</p>
      <p>Your reset code: <strong style="font-size:22px;letter-spacing:4px">${code}</strong></p>
      <p><a href="${resetUrl}" style="background:#d4af37;color:#000;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">Reset Password</a></p>
      <p style="color:#666;font-size:13px">Expires in 1 hour.</p>
    </div>`;
  return sendEmail(to, subject, html, text);
}

export async function sendPhoneOtpEmail(
  to: string,
  name: string,
  code: string
) {
  const subject = "TechFlare account recovery code";
  const text = `Hi ${name}, your recovery OTP is: ${code}. Expires in 15 minutes.`;
  const html = `<p>Hi ${name}, your recovery OTP is <strong>${code}</strong>. Expires in 15 minutes.</p>`;
  return sendEmail(to, subject, html, text);
}
