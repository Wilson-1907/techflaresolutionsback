import { NextRequest, NextResponse } from "next/server";
import { verifyFinanceApiKey, financeUnauthorized } from "@/lib/finance-api";
import { buildFinanceReport } from "@/lib/finance-ledger";

export async function GET(req: NextRequest) {
  if (!verifyFinanceApiKey(req)) return financeUnauthorized();

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  const from = fromParam ? new Date(fromParam) : undefined;
  const to = toParam ? new Date(toParam) : undefined;

  const report = await buildFinanceReport(from, to);
  return NextResponse.json(report);
}
