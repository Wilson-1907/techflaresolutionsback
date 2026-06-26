import { NextResponse } from "next/server";
import { getSessionFull } from "@/lib/auth";

export async function GET() {
  const user = await getSessionFull();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      points: user.points,
      communityMember: user.communityMember,
      emailVerified: user.emailVerified,
    },
  });
}
