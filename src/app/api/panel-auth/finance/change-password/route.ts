import { NextRequest, NextResponse } from "next/server";
import { financeUnauthorized, verifyFinanceApiKey } from "@/lib/finance-api";
import { changePanelPassword } from "@/lib/panel-auth";
import { rateLimit } from "@/lib/security";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 5, 15 * 60_000);
  if (limited) return limited;

  if (!verifyFinanceApiKey(req)) return financeUnauthorized();

  try {
    const { currentPassword, newPassword, confirmPassword } = await req.json();
    const result = await changePanelPassword("finance", currentPassword, newPassword, confirmPassword);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Password change failed" }, { status: 500 });
  }
}
