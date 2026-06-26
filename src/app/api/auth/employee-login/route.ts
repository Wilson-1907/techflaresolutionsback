import { NextRequest, NextResponse } from "next/server";
import { rateLimit, validateOrigin } from "@/lib/security";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";
import { setAuthCookie } from "@/lib/verification";
import { requiresStaffLoginOtp, startStaffLoginOtp } from "@/lib/staff-login-otp";
import { z } from "zod";

const schema = z.object({
  workId: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 15 * 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const workId = body.workId.toUpperCase().trim();

    const profile = await prisma.employeeProfile.findUnique({
      where: { workId },
      include: { user: true },
    });

    if (!profile || !profile.active || !profile.user.passwordHash) {
      return NextResponse.json({ error: "Invalid work ID or password" }, { status: 401 });
    }

    if (!(await verifyPassword(body.password, profile.user.passwordHash))) {
      return NextResponse.json({ error: "Invalid work ID or password" }, { status: 401 });
    }

    const user = profile.user;

    if (requiresStaffLoginOtp(user.role)) {
      const otp = await startStaffLoginOtp(user);
      return NextResponse.json({ ...otp, workId: profile.workId, position: profile.position });
    }

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
        workId: profile.workId,
        position: profile.position,
      },
      token,
    });
    setAuthCookie(response, token);
    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
