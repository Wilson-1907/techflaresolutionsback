import { NextRequest, NextResponse } from "next/server";
import { rateLimit, validateOrigin } from "@/lib/security";
import { prisma } from "@/lib/db";
import { sendPhoneOtpEmail, sendPasswordResetEmail } from "@/lib/email";
import { createVerification } from "@/lib/verification";
import { hashForLookup } from "@/lib/encryption";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
}).refine((d) => d.email || d.phone, { message: "Email or phone required" });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 5, 60 * 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const data = schema.parse(await req.json());

    let user = null;
    if (data.email) {
      user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    } else if (data.phone) {
      user = await prisma.user.findFirst({ where: { phoneHash: hashForLookup(data.phone) } });
    }

    if (!user) {
      return NextResponse.json({
        message: "If an account exists, recovery instructions were sent.",
      });
    }

    if (data.phone && user.phone && user.email) {
      const verification = await createVerification(user.id, "PHONE_OTP", 15);
      void sendPhoneOtpEmail(user.email, user.firstName, verification.code).catch((err) =>
        console.error("[forgot-password] phone OTP email failed:", err)
      );
      return NextResponse.json({
        message: "Recovery OTP sent to your registered email.",
        method: "email_otp",
      });
    }

    if (!user.passwordHash) {
      return NextResponse.json({
        message: "This account uses Google sign-in. Please sign in with Google.",
      });
    }

    const verification = await createVerification(user.id, "PASSWORD_RESET", 60);
    void sendPasswordResetEmail(user.email, user.firstName, verification.code, verification.token).catch(
      (err) => console.error("[forgot-password] email failed:", err)
    );

    return NextResponse.json({
      message: "Password reset instructions sent to your email.",
      method: "email",
    });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
