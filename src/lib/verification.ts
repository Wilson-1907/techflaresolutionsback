import crypto from "crypto";
import { prisma } from "./db";

export function generateOtp(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(crypto.randomInt(100000, 1000000));
    if (!isWeakOtp(code)) return code;
  }
  return String(crypto.randomInt(100000, 1000000));
}

function isWeakOtp(code: string): boolean {
  if (/^(\d)\1{5}$/.test(code)) return true;
  const seq = "0123456789";
  if (seq.includes(code) || [...seq].reverse().join("").includes(code)) return true;
  if (new Set(code).size === 1) return true;
  return false;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createVerification(
  userId: string,
  type: "EMAIL_VERIFY" | "PASSWORD_RESET" | "PHONE_OTP" | "STAFF_LOGIN",
  expiresMinutes: number
) {
  await prisma.authVerification.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  return prisma.authVerification.create({
    data: {
      userId,
      type,
      code: generateOtp(),
      token: generateToken(),
      expiresAt: new Date(Date.now() + expiresMinutes * 60_000),
    },
  });
}

export async function consumeVerification(params: {
  type: string;
  token?: string;
  code?: string;
  email?: string;
}) {
  let userId: string | undefined;
  if (params.email) {
    const u = await prisma.user.findUnique({ where: { email: params.email.toLowerCase() } });
    if (!u) return null;
    userId = u.id;
  }

  const record = await prisma.authVerification.findFirst({
    where: {
      type: params.type,
      usedAt: null,
      expiresAt: { gt: new Date() },
      ...(params.token ? { token: params.token } : {}),
      ...(params.code ? { code: params.code } : {}),
      ...(userId && !params.token ? { userId } : {}),
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return null;

  await prisma.authVerification.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record;
}

export function setAuthCookie(response: import("next/server").NextResponse, token: string) {
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}
