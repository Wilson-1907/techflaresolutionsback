import { prisma } from "./db";
import { createVerification, consumeVerification } from "./verification";
import { sendEmail } from "./email";

export const STAFF_ROLES = ["EMPLOYEE", "HOD", "CIO", "ADMIN"] as const;

export function requiresStaffLoginOtp(role: string) {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function startStaffLoginOtp(user: { id: string; email: string; firstName: string }) {
  const verification = await createVerification(user.id, "STAFF_LOGIN", 15);
  await sendEmail(
    user.email,
    "TechFlare staff sign-in code",
    `<p>Hi ${user.firstName},</p><p>Your sign-in verification code is <strong>${verification.code}</strong>.</p><p>Expires in 15 minutes.</p>`,
    `Staff sign-in code: ${verification.code}. Expires in 15 minutes.`
  );
  return {
    requires2fa: true as const,
    challengeToken: verification.token,
    emailHint: maskEmail(user.email),
  };
}

export async function completeStaffLoginOtp(challengeToken: string, code: string) {
  const record = await consumeVerification({
    type: "STAFF_LOGIN",
    token: challengeToken,
    code: code.trim(),
  });
  if (!record?.user) {
    return { ok: false as const, error: "Invalid or expired verification code" };
  }
  return { ok: true as const, user: record.user };
}
