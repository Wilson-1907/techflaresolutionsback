import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";

const jobSchema = z.object({
  title: z.string().min(3),
  department: z.string().min(2),
  location: z.string().min(2),
  type: z.enum(["full_time", "internship", "graduate"]),
  description: z.string().min(20),
  requirements: z.string().min(10),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("all") === "true";

  if (includeInactive && !verifyAdminApiKey(req)) {
    return adminUnauthorized();
  }

  try {
    const jobs = await prisma.jobPosting.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ jobs });
  } catch {
    return NextResponse.json({ jobs: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  try {
    const body = jobSchema.parse(await req.json());
    const job = await prisma.jobPosting.create({
      data: {
        ...body,
        active: body.active ?? true,
      },
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create job posting" }, { status: 500 });
  }
}
