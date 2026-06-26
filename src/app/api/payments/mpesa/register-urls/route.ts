import { NextRequest, NextResponse } from "next/server";
import { isTrustedFinanceRequest } from "@/lib/finance-api";
import { isTrustedAdminRequest } from "@/lib/admin-api";
import { getMpesaStatus, registerC2BUrls } from "@/lib/mpesa";

export async function POST(req: NextRequest) {
  if (!isTrustedFinanceRequest(req) && !isTrustedAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await registerC2BUrls();
    return NextResponse.json({
      ok: true,
      message: "C2B URLs registered with Safaricom Daraja",
      status: getMpesaStatus(),
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message, status: getMpesaStatus() }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  if (!isTrustedFinanceRequest(req) && !isTrustedAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getMpesaStatus());
}
