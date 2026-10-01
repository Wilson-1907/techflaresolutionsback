import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { mainSiteFetch } from "@/lib/main-site";

async function guard() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  try {
    const data = await mainSiteFetch("/api/news?all=true");
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load news";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const body = await req.json();
    const data = await mainSiteFetch("/api/news", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create news";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
