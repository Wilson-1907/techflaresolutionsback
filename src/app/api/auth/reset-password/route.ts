import { NextRequest, NextResponse } from "next/server";
import { rateLimit, validateOrigin } from "@/lib/security";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { validatePassword } from "@/lib/password-policy";
import { consumeVerification } from "@/lib/verification";
import { z } from "zod";

const schema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8).optional(),
    token: z.string().optional(),
    code: z.string().length(6).optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.token || (d.code && d.email), {
    message: "Token or code+email required",
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", message: "Passwords do not match.", path: ["confirmPassword"] });
    }
    const strength = validatePassword(data.password);
    if (!strength.ok) {
      ctx.addIssue({ code: "custom", message: strength.message, path: ["password"] });
    }
  });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 5, 60 * 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());

    const record = await consumeVerification({
      type: "PASSWORD_RESET",
      token: body.token,
      code: body.code,
      email: body.email,
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid or expired reset code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(body.password) },
    });

    return NextResponse.json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
