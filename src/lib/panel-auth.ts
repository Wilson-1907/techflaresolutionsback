import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { passwordsMatch, validatePassword } from "./password-policy";

export type PanelType = "admin" | "finance";

function envPassword(panel: PanelType): string | null {
  if (panel === "admin") {
    return process.env.ADMIN_PANEL_PASSWORD?.trim() || null;
  }
  return process.env.FINANCE_PANEL_PASSWORD?.trim() || null;
}

function devFallback(panel: PanelType): string {
  return panel === "admin" ? "admin123" : "finance123";
}

async function storePasswordHash(panel: PanelType, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.panelCredential.upsert({
    where: { panel },
    create: { panel, passwordHash },
    update: { passwordHash },
  });
}

export async function verifyPanelPassword(panel: PanelType, password: string): Promise<boolean> {
  const record = await prisma.panelCredential.findUnique({ where: { panel } });
  if (record) {
    return bcrypt.compare(password, record.passwordHash);
  }

  const env = envPassword(panel);
  const candidates = [env, process.env.NODE_ENV !== "production" ? devFallback(panel) : null].filter(
    Boolean
  ) as string[];

  for (const candidate of candidates) {
    if (password === candidate) {
      await storePasswordHash(panel, password);
      return true;
    }
  }

  return false;
}

export async function changePanelPassword(
  panel: PanelType,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const match = passwordsMatch(newPassword, confirmPassword);
  if (!match.ok) return { ok: false, error: match.message };

  const strength = validatePassword(newPassword);
  if (!strength.ok) return { ok: false, error: strength.message };

  if (currentPassword === newPassword) {
    return { ok: false, error: "New password must be different from the current password." };
  }

  const valid = await verifyPanelPassword(panel, currentPassword);
  if (!valid) {
    return { ok: false, error: "Current password is incorrect." };
  }

  await storePasswordHash(panel, newPassword);
  return { ok: true };
}

export async function seedPanelPassword(
  panel: PanelType,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.panelCredential.findUnique({ where: { panel } });
  if (existing) {
    return { ok: false, error: "Panel password already configured." };
  }

  if (!password || typeof password !== "string") {
    return { ok: false, error: "Password required." };
  }

  await storePasswordHash(panel, password);
  return { ok: true };
}
