import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { getAdminPanelPassword } from "@/lib/env";

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimitLogin(req: NextRequest): NextResponse | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return null;
  }

  entry.count += 1;
  if (entry.count > 10) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const limited = rateLimitLogin(req);
  if (limited) return limited;

  const { password } = await req.json();
  const expected = getAdminPanelPassword();

  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
