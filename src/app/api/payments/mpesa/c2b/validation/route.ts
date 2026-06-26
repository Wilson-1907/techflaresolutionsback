import { NextRequest, NextResponse } from "next/server";

/** Daraja C2B validation — accept all till payments (required by Safaricom). */
export async function POST(_req: NextRequest) {
  return NextResponse.json({
    ResultCode: 0,
    ResultDesc: "Accepted",
  });
}
