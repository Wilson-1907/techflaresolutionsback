import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { slugify } from "@/lib/utils";

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  category: z.enum(["announcement", "award", "press_release", "achievement"]).optional(),
  excerpt: z.string().min(10).optional(),
  content: z.string().min(20).optional(),
  authorName: z.string().optional(),
  published: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isAdmin = verifyAdminApiKey(req);

  const article = await prisma.newsArticle.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      ...(isAdmin ? {} : { published: true }),
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  return NextResponse.json({ article });
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

    if (body.title) {
      let slug = slugify(body.title);
      const clash = await prisma.newsArticle.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;
      data.slug = slug;
    }

    if (body.publishedAt) {
      data.publishedAt = new Date(body.publishedAt);
    }

    const article = await prisma.newsArticle.update({
      where: { id },
      data,
    });

    return NextResponse.json({ article });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const { id } = await params;

  await prisma.newsArticle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
