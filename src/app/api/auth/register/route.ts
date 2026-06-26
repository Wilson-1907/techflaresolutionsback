import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { rateLimit, validateOrigin } from "@/lib/security";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { passwordsMatch, validatePassword } from "@/lib/password-policy";
import { trySendVerificationEmail } from "@/lib/email";
import { createVerification } from "@/lib/verification";
import { acceptedTermsField, receiveCommunicationsField } from "@/lib/consent";
import { z } from "zod";

const schema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    role: z.enum(["CLIENT", "INNOVATOR"]).default("CLIENT"),
    company: z.string().optional(),
    phone: z.string().optional(),
    acceptedTerms: acceptedTermsField,
    receiveCommunications: receiveCommunicationsField,
  })
  .superRefine((data, ctx) => {
    const match = passwordsMatch(data.password, data.confirmPassword);
    if (!match.ok) {
      ctx.addIssue({ code: "custom", message: match.message, path: ["confirmPassword"] });
    }
    const strength = validatePassword(data.password);
    if (!strength.ok) {
      ctx.addIssue({ code: "custom", message: strength.message, path: ["password"] });
    }
  });

async function sendRegisterOtp(user: { id: string; email: string; firstName: string }) {
  const verification = await createVerification(user.id, "EMAIL_VERIFY", 24 * 60);
  const { sent, error } = await trySendVerificationEmail(
    user.email,
    user.firstName,
    verification.code,
    verification.token
  );
  return { sent, error, code: verification.code };
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 5, 60 * 60_000);
  if (limited) return limited;

  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.emailVerified && existing.passwordHash) {
        const samePassword = await verifyPassword(data.password, existing.passwordHash);
        if (samePassword) {
          const { sent, error } = await sendRegisterOtp(existing);
          return NextResponse.json({
            message: sent
              ? "A new verification code was sent to your email."
              : "Account exists but email could not be sent. Use Resend code on the next page.",
            email: existing.email,
            requiresVerification: true,
            emailSent: sent,
            emailError: sent ? undefined : error,
            alreadyRegistered: true,
          });
        }
        return NextResponse.json(
          {
            error: "This email is registered but not verified yet. Use the same password here to get a new code, or open the OTP page.",
            code: "EMAIL_NOT_VERIFIED",
            email: existing.email,
            requiresVerification: true,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: existing.emailVerified
            ? "Email already registered. Sign in instead."
            : "Email already registered but not verified. Sign in with your password to open the OTP page, or use the same password here to get a new code.",
          code: existing.emailVerified ? "EMAIL_EXISTS" : "EMAIL_NOT_VERIFIED",
          email: existing.email,
          requiresVerification: !existing.emailVerified,
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        company: data.company,
        phone: data.phone || null,
        marketingOptIn: data.receiveCommunications,
        authProvider: "email",
        emailVerified: false,
      },
    });

    const { sent, error } = await sendRegisterOtp(user);

    return NextResponse.json({
      message: sent
        ? "Account created. Check your email for the 6-digit code."
        : "Account created but email could not be sent. Use Resend code on the verification page.",
      email: user.email,
      requiresVerification: true,
      emailSent: sent,
      emailError: sent ? undefined : error,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[register] failed:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Email already registered" }, { status: 400 });
      }
      if (error.code === "P2021" || error.code === "P2022") {
        return NextResponse.json(
          { error: "Database schema is out of date. Contact support or try again shortly." },
          { status: 503 }
        );
      }
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again in a few minutes." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Registration failed. Please try again or contact support." }, { status: 500 });
  }
}
