import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveAiSession, aiSessionStatus } from "@/lib/ai-session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const aiSession = await getActiveAiSession(session.id);
  return NextResponse.json(aiSessionStatus(aiSession));
}
