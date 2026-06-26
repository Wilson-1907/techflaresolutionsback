import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { rateLimit, validateOrigin } from "@/lib/security";
import { z } from "zod";

const schema = z.object({
  communityEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 3, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const data = schema.parse(await req.json());

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        communityMember: true,
        communityEmail: data.communityEmail,
        communityJoinedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Community membership recorded. Welcome to the TechFlare Solutions community!",
    });
  } catch {
    return NextResponse.json({ error: "Could not update community status" }, { status: 400 });
  }
}
