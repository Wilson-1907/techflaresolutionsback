import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  targetType: z.enum(["product", "service", "project", "workflow"]),
  targetRef: z.string().min(1),
  targetTitle: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ratings = await prisma.serviceRating.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ratings });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());

    const rating = await prisma.serviceRating.upsert({
      where: {
        userId_targetType_targetRef: {
          userId: session.id,
          targetType: body.targetType,
          targetRef: body.targetRef,
        },
      },
      create: {
        userId: session.id,
        ...body,
      },
      update: {
        rating: body.rating,
        comment: body.comment,
        targetTitle: body.targetTitle,
      },
    });

    return NextResponse.json({ rating }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }
}
