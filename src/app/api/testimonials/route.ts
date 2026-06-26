import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireVerifiedAuth } from "@/lib/api-guard";
import { verifyAdminApiKey } from "@/lib/admin-api";

const createSchema = z.object({
  authorName: z.string().min(2),
  authorTitle: z.string().optional(),
  authorRole: z.string().optional(),
  company: z.string().optional(),
  content: z.string().min(20).max(1000),
  rating: z.number().int().min(1).max(5).default(5),
  featured: z.boolean().optional(),
  approved: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const isAdmin = verifyAdminApiKey(req);
  const all = req.nextUrl.searchParams.get("all") === "true";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 20), 50);

  const testimonials = await prisma.testimonial.findMany({
    where: isAdmin && all ? undefined : { approved: true },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ testimonials });
}

export async function POST(req: NextRequest) {
  const isAdmin = verifyAdminApiKey(req);
  let user = null;

  if (!isAdmin) {
    const verified = await requireVerifiedAuth();
    if (verified instanceof NextResponse) return verified;
    user = verified.user;
  }

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const testimonial = await prisma.testimonial.create({
      data: {
        authorName: isAdmin ? parsed.authorName : `${user!.firstName} ${user!.lastName}`,
        authorTitle: parsed.authorTitle,
        authorRole: parsed.authorRole || user?.role.toLowerCase(),
        company: parsed.company,
        content: parsed.content,
        rating: parsed.rating,
        userId: user?.id,
        approved: isAdmin ? (parsed.approved ?? true) : false,
        featured: isAdmin ? (parsed.featured ?? false) : false,
      },
    });

    return NextResponse.json(
      {
        testimonial,
        message: isAdmin
          ? "Testimonial published."
          : "Thank you! Your testimonial is pending admin approval.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to submit testimonial" }, { status: 500 });
  }
}
