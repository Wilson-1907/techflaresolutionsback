import jwt, { type SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { getJwtSecret } from "./env";
import type { UserRole } from "@prisma/client";

function jwtSecret() {
  return getJwtSecret();
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  points?: number;
  communityMember?: boolean;
}

export async function getSessionFull() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      points: true,
      communityMember: true,
      emailVerified: true,
    },
  });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser) {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    jwtSecret(),
    { expiresIn }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, jwtSecret()) as AuthUser & { id: string };
    return {
      id: payload.id,
      email: payload.email,
      firstName: payload.firstName || "",
      lastName: payload.lastName || "",
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  return sessionFromToken(token);
}

/** Resolve session from proxied Cookie header when cookies() is empty. */
export async function sessionFromCookieHeader(cookieHeader: string | null): Promise<AuthUser | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (!match?.[1]) return null;
  return sessionFromToken(decodeURIComponent(match[1]));
}

async function sessionFromToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  return user;
}

export async function getSessionFromRequest(req: Request): Promise<AuthUser | null> {
  const direct = await getSession();
  if (direct) return direct;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const fromBearer = await sessionFromToken(authHeader.slice(7).trim());
    if (fromBearer) return fromBearer;
  }

  return sessionFromCookieHeader(req.headers.get("cookie"));
}

export function requireRole(user: AuthUser | null, roles: UserRole[]) {
  if (!user || !roles.includes(user.role)) {
    return false;
  }
  return true;
}
