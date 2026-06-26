import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";

const updateSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  reviewNotes: z.string().optional(),
  title: z.string().min(5).optional(),
  excerpt: z.string().min(20).optional(),
  content: z.string().min(50).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isAdmin = verifyAdminApiKey(req);
  const session = await getSession();

  const post = await prisma.blogPost.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      author: { select: { firstName: true, lastName: true, role: true, company: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
  }

  if (post.status !== "APPROVED" && !isAdmin && post.authorId !== session?.id) {
    return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const { id } = await params;

  try {
    const body = updateSchema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };

    if (body.status === "APPROVED") {
      data.publishedAt = new Date();
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data,
      include: {
        author: { select: { firstName: true, lastName: true, role: true, company: true } },
      },
    });

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update blog post" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();
  const { id } = await params;
  await prisma.blogPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
