import { NextRequest, NextResponse } from "next/server";
import { rateLimit, validateOrigin } from "@/lib/security";
import { prisma } from "@/lib/db";
import { getEmailConfigStatus, trySendVerificationEmail } from "@/lib/email";
import { createVerification } from "@/lib/verification";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 3, 60 * 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const { email } = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user || user.emailVerified) {
      return NextResponse.json({ message: "If an account exists, a new code was sent.", emailSent: true });
    }

    if (!getEmailConfigStatus().configured) {
      return NextResponse.json(
        {
          error: "Email is not configured on the server. Contact stechflare@gmail.com.",
          emailSent: false,
        },
        { status: 503 }
      );
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
        {
          error: error || "Could not send email. On Render free tier, set RESEND_API_KEY (Gmail SMTP is blocked).",
          emailSent: false,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      message: "Verification email sent. Check your inbox and spam folder.",
      emailSent: true,
    });
  } catch {
    return NextResponse.json({ error: "Could not resend verification" }, { status: 500 });
  }
}
