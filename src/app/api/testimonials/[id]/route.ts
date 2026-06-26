import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";

const updateSchema = z.object({
  approved: z.boolean().optional(),
  featured: z.boolean().optional(),
  authorName: z.string().optional(),
  authorTitle: z.string().optional(),
  company: z.string().optional(),
  content: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const { id } = await params;

  try {
    const body = updateSchema.parse(await req.json());
    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: body,
    });
    return NextResponse.json({ testimonial });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update testimonial" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();
  const { id } = await params;
  await prisma.testimonial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
