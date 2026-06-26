import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, validateOrigin } from "@/lib/security";
import { signToken } from "@/lib/auth";
import { setAuthCookie } from "@/lib/verification";
import { completeStaffLoginOtp } from "@/lib/staff-login-otp";

const schema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(4).max(8),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 15 * 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const result = await completeStaffLoginOtp(body.challengeToken, body.code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const user = result.user;
    const token = signToken({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      token,
    });
    setAuthCookie(response, token);
    return response;
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
