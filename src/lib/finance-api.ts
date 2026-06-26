import { NextRequest, NextResponse } from "next/server";
import { getFinanceApiKey } from "@/lib/env";

function normalizeApiKey(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

export function verifyFinanceApiKey(req: NextRequest): boolean {
  const expected = normalizeApiKey(getFinanceApiKey());
  if (!expected) return false;
  const provided = normalizeApiKey(req.headers.get("x-finance-api-key"));
  return provided.length > 0 && provided === expected;
}

export function isTrustedFinanceRequest(req: NextRequest): boolean {
  return verifyFinanceApiKey(req);
}

export function financeUnauthorized() {
  return NextResponse.json({ error: "Invalid or missing finance API key" }, { status: 401 });
}
