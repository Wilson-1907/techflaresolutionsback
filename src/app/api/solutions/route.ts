import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVerifiedAuth } from "@/lib/api-guard";
import { rateLimit, validateOrigin } from "@/lib/security";
import { SUBMISSION_LIMITS } from "@/lib/company-positions";
import { createWorkflowFromSolution } from "@/lib/workflows";
import { z } from "zod";

const schema = z.object({
  problem: z
    .string()
    .min(SUBMISSION_LIMITS.solutionProblemMin, "Please describe your need clearly in a few sentences.")
    .max(SUBMISSION_LIMITS.solutionProblemMax, `Keep your request under ${SUBMISSION_LIMITS.solutionProblemMax} characters.`),
  budget: z.string().min(1),
  industry: z.string().min(1),
  timeline: z.string().min(1),
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

    const solution = await prisma.solutionRequest.create({
      data: {
        problem: data.problem,
        budget: data.budget,
        industry: data.industry,
        timeline: data.timeline,
        userId: auth.user.id,
        guestName: `${auth.user.firstName} ${auth.user.lastName}`,
        guestEmail: auth.user.email,
      },
    });

    await createWorkflowFromSolution(solution.id);

    return NextResponse.json({
      id: solution.id,
      message: "Request received. Track it under My requests — wait for our team to approve or reject.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
