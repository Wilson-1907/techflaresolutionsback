import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isTrustedFinanceRequest } from "@/lib/finance-api";
import { isTrustedAdminRequest } from "@/lib/admin-api";
import { generateScopeFromDescription } from "@/lib/ai-scope-generator";

const schema = z.object({
  projectDescription: z.string().min(10).max(8000),
});

const STAFF_ROLES = new Set(["HOD", "ADMIN", "CIO", "EMPLOYEE"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  const financeTrusted = isTrustedFinanceRequest(req);
  const adminTrusted = isTrustedAdminRequest(req);

  const allowed =
    financeTrusted ||
    adminTrusted ||
    (session && STAFF_ROLES.has(session.role));

  if (!allowed) {
    return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const result = await generateScopeFromDescription(body.projectDescription);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not generate scope";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
