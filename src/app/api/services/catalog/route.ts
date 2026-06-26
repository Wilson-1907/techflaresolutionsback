import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyAdminApiKey } from "@/lib/admin-api";
import { verifyFinanceApiKey } from "@/lib/finance-api";
import { getPricedCatalog } from "@/lib/service-catalog-pricing";
import { getPublicCatalog } from "@/lib/service-catalog-public";

const STAFF_ROLES = new Set(["HOD", "ADMIN", "CIO", "EMPLOYEE"]);

export async function GET(req: NextRequest) {
  const wantsPriced = req.nextUrl.searchParams.get("priced") === "1";

  if (!wantsPriced) {
    return NextResponse.json(getPublicCatalog());
  }

  const session = await getSession();
  const staffSession = Boolean(session && STAFF_ROLES.has(session.role));
  const trusted = staffSession || verifyAdminApiKey(req) || verifyFinanceApiKey(req);

  if (!trusted) {
    return NextResponse.json({ error: "Staff access required for internal rates." }, { status: 403 });
  }

  const data = await getPricedCatalog();
  return NextResponse.json(data);
}
