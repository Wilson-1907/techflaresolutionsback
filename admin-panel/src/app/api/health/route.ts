import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "techflare-admin-panel",
    timestamp: new Date().toISOString(),
  });
}
