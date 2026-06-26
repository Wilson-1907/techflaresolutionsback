import { NextRequest, NextResponse } from "next/server";
import { rateLimit, validateOrigin } from "@/lib/security";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { setAuthCookie, consumeVerification } from "@/lib/verification";
import { z } from "zod";

const postSchema = z.object({
  email: z.string().email().optional(),
  code: z.string().length(6).optional(),
  token: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const record = await consumeVerification({ type: "EMAIL_VERIFY", token });
  if (!record) {
    return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerified: true },
  });

  const jwt = signToken({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  });

  const response = NextResponse.json({
    message: "Email verified successfully",
    user: { id: user.id, email: user.email, role: user.role },
    token: jwt,
  });
  setAuthCookie(response, jwt);
  return response;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 15 * 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = postSchema.parse(await req.json());
    if (!body.code && !body.token) {
      return NextResponse.json({ error: "Code or token required" }, { status: 400 });
    }
    if (body.code && !body.email) {
      return NextResponse.json({ error: "Email required with code" }, { status: 400 });
    }

    const record = await consumeVerification({
      type: "EMAIL_VERIFY",
      token: body.token,
      code: body.code,
      email: body.email,
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });

    const jwt = signToken({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });

    const response = NextResponse.json({
      message: "Email verified",
      user: { id: user.id, email: user.email, role: user.role },
      token: jwt,
    });
    setAuthCookie(response, jwt);
    return response;
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
