import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCommunityMember } from "@/lib/api-guard";
import { rateLimit, validateOrigin } from "@/lib/security";
import { z } from "zod";

const schema = z.object({
  jobTitle: z.string().min(1),
  applicantName: z.string().min(2),
  applicantEmail: z.string().email(),
  applicantPhone: z.string().optional(),
  coverLetter: z.string().min(50),
  communityConfirmed: z.literal(true),
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 5, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireCommunityMember();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    if (body.website) return NextResponse.json({ error: "Rejected" }, { status: 400 });

    const data = schema.parse(body);

    await prisma.careerApplication.create({
      data: {
        jobTitle: data.jobTitle,
        applicantName: data.applicantName,
        applicantEmail: data.applicantEmail,
        applicantPhone: data.applicantPhone,
        coverLetter: data.coverLetter,
        communityMember: true,
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ message: "Application submitted successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Application failed" }, { status: 500 });
  }
}
