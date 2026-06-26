import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEmailConfigStatus, trySendVerificationEmail } from "@/lib/email";
import { createVerification } from "@/lib/verification";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

function authorize(req: NextRequest): boolean {
  const key = process.env.ADMIN_API_KEY?.trim();
  if (!key) return false;
  const header = req.headers.get("x-admin-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === key;
}

/** POST — send a verification OTP for smoke-testing email delivery. */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email } = schema.parse(await req.json());
    const normalized = email.toLowerCase();
    const config = getEmailConfigStatus();

    if (!config.configured) {
      return NextResponse.json(
        { error: "Email not configured. Set RESEND_API_KEY on Render.", emailSent: false, config },
        { status: 503 }
      );
    }

    let user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, firstName: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalized,
          firstName: "Test",
          lastName: "User",
          role: "CLIENT",
          authProvider: "email",
          emailVerified: false,
        },
        select: { id: true, email: true, firstName: true },
      });
    }

    const verification = await createVerification(user.id, "EMAIL_VERIFY", 24 * 60);
    const { sent, error } = await trySendVerificationEmail(
      user.email,
      user.firstName,
      verification.code,
      verification.token
    );

    if (!sent) {
      return NextResponse.json(
        { error: error || "Send failed", emailSent: false, provider: config.provider },
        { status: 503 }
      );
    }

    return NextResponse.json({
      message: `Verification OTP sent to ${normalized}`,
      emailSent: true,
      provider: config.provider,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error("[admin/send-test-otp]", error);
    return NextResponse.json({ error: "Failed to send test OTP" }, { status: 500 });
  }
}
