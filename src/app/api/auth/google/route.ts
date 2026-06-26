import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { rateLimit, validateOrigin } from "@/lib/security";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { trySendVerificationEmail } from "@/lib/email";
import { setAuthCookie, createVerification } from "@/lib/verification";
import { acceptedTermsField, receiveCommunicationsField } from "@/lib/consent";
import { z } from "zod";

const schema = z.object({
  credential: z.string().min(1),
  role: z.enum(["CLIENT", "INNOVATOR"]).optional(),
  acceptedTerms: acceptedTermsField,
  receiveCommunications: receiveCommunicationsField,
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 15 * 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 503 });
  }

  try {
    const body = schema.parse(await req.json());
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: body.credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }

    const email = payload.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    if (!user && payload.sub) {
      user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
    }

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email,
          googleId: payload.sub,
          authProvider: "google",
          emailVerified: true,
          firstName: payload.given_name || payload.name?.split(" ")[0] || "User",
          lastName: payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "",
          role: body.role || "CLIENT",
          marketingOptIn: body.receiveCommunications,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
          authProvider: user.passwordHash ? user.authProvider : "google",
          emailVerified: true,
          ...(body.receiveCommunications ? { marketingOptIn: true } : {}),
        },
      });
    } else if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    if (!user.emailVerified) {
      const verification = await createVerification(user.id, "EMAIL_VERIFY", 24 * 60);
      await trySendVerificationEmail(user.email, user.firstName, verification.code, verification.token);

      return NextResponse.json({
        requiresVerification: true,
        isNewUser,
        email: user.email,
        message: "We sent a 6-digit verification code to your email. Enter it to complete sign-in.",
      });
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
        emailVerified: true,
      },
      token,
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Google sign-in failed" }, { status: 401 });
  }
}
