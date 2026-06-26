import { prisma } from "./db";
import { generateOtp } from "./verification";
import { sendEmail } from "./email";
import { verifyPanelPassword, type PanelType } from "./panel-auth";

function panelMfaEmail(panel: PanelType): string {
  const specific =
    panel === "admin"
      ? process.env.ADMIN_PANEL_MFA_EMAIL?.trim()
      : process.env.FINANCE_PANEL_MFA_EMAIL?.trim();
  const fallback =
    process.env.RESEND_FROM?.trim() ||
    process.env.ADMIN_ALERT_EMAIL?.trim() ||
    "solutionstechflare@gmail.com";
  return specific || fallback;
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***@${domain}`;
}

export async function startPanelLoginOtp(panel: PanelType, password: string) {
  const valid = await verifyPanelPassword(panel, password);
  if (!valid) {
    return { ok: false as const, error: "Invalid password" };
  }

  await prisma.panelLoginChallenge.updateMany({
    where: { panel, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateOtp();
  const challenge = await prisma.panelLoginChallenge.create({
    data: {
      panel,
      code,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });

  const email = panelMfaEmail(panel);
  const label = panel === "admin" ? "Admin" : "Finance";
  try {
    await sendEmail(
      email,
      `${label} panel sign-in code`,
      `<p>Your ${label} panel verification code is <strong>${code}</strong>.</p><p>Expires in 10 minutes. If you did not request this, ignore this email.</p>`,
      `${label} panel code: ${code}. Expires in 10 minutes.`
    );
  } catch (err) {
    await prisma.panelLoginChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });
    const message = err instanceof Error ? err.message : "Could not send verification email";
    return { ok: false as const, error: `Could not send verification email. ${message}` };
  }

  return {
    ok: true as const,
    challengeId: challenge.id,
    emailHint: maskEmail(email),
  };
}

export async function completePanelLoginOtp(panel: PanelType, challengeId: string, code: string) {
  const challenge = await prisma.panelLoginChallenge.findFirst({
    where: {
      id: challengeId,
      panel,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!challenge || challenge.code !== code.trim()) {
    return { ok: false as const, error: "Invalid or expired verification code" };
  }

  await prisma.panelLoginChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  });

  return { ok: true as const };
}
