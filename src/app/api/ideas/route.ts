import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireVerifiedAuth } from "@/lib/api-guard";
import { rateLimit, validateOrigin } from "@/lib/security";
import { SUBMISSION_LIMITS } from "@/lib/company-positions";
import { createWorkflowFromIdea } from "@/lib/workflows";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(3).max(SUBMISSION_LIMITS.ideaTitleMax),
  description: z
    .string()
    .min(SUBMISSION_LIMITS.ideaDescriptionMin, "Description is too short — explain the idea clearly in a few sentences.")
    .max(SUBMISSION_LIMITS.ideaDescriptionMax, `Keep your description under ${SUBMISSION_LIMITS.ideaDescriptionMax} characters.`),
  category: z.string().min(1),
  type: z.enum(["idea", "invention", "business_concept"]),
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireVerifiedAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    if (body.website) return NextResponse.json({ error: "Rejected" }, { status: 400 });

    const data = schema.parse(body);

    const idea = await prisma.idea.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        type: data.type,
        userId: auth.user.id,
      },
    });

    await createWorkflowFromIdea(idea.id);

    return NextResponse.json({
      id: idea.id,
      message: "Idea received. Track it under Track submissions — wait for our team to approve or reject.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const ideas = await prisma.idea.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(ideas);
}
