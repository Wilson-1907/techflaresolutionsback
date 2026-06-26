import { NextRequest, NextResponse } from "next/server";
import { parseC2bPayload } from "@/lib/mpesa";
import { applyC2bConfirmation } from "@/lib/mpesa-c2b";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = parseC2bPayload(payload);
    if (parsed) {
      await applyC2bConfirmation(parsed);
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
