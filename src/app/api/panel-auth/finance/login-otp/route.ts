import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { financeUnauthorized, verifyFinanceApiKey } from "@/lib/finance-api";
import { rateLimit } from "@/lib/security";
import { completePanelLoginOtp, startPanelLoginOtp } from "@/lib/panel-login-otp";

const startSchema = z.object({ password: z.string().min(1) });
const verifySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(4).max(8),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 15 * 60_000);
  if (limited) return limited;
  if (!verifyFinanceApiKey(req)) return financeUnauthorized();

  try {
    const body = await req.json();
    if (body.challengeId != null) {
      const data = verifySchema.parse(body);
      const result = await completePanelLoginOtp("finance", data.challengeId, data.code);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      return NextResponse.json({ ok: true });
    }

    const data = startSchema.parse(body);
    const result = await startPanelLoginOtp("finance", data.password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    return NextResponse.json({
      requiresOtp: true,
      challengeId: result.challengeId,
      emailHint: result.emailHint,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("finance login-otp:", e);
    return NextResponse.json({ error: "Sign-in failed" }, { status: 500 });
  }
}
