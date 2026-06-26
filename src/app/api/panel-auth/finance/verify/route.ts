import { NextRequest, NextResponse } from "next/server";
import { financeUnauthorized, verifyFinanceApiKey } from "@/lib/finance-api";
import { verifyPanelPassword } from "@/lib/panel-auth";
import { rateLimit } from "@/lib/security";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 15 * 60_000);
  if (limited) return limited;

  if (!verifyFinanceApiKey(req)) return financeUnauthorized();

  try {
    const { password } = await req.json();
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const ok = await verifyPanelPassword("finance", password);
    if (!ok) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
