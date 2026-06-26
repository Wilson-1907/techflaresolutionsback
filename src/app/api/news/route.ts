import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { slugify } from "@/lib/utils";

const newsSchema = z.object({
  title: z.string().min(3),
  category: z.enum(["announcement", "award", "press_release", "achievement"]),
  excerpt: z.string().min(10),
  content: z.string().min(20),
  authorName: z.string().optional(),
  published: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const includeDrafts = req.nextUrl.searchParams.get("all") === "true";

  if (includeDrafts && !verifyAdminApiKey(req)) {
    return adminUnauthorized();
  }

  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const take = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 100) : undefined;

    const articles = await prisma.newsArticle.findMany({
      where: includeDrafts ? undefined : { published: true },
      orderBy: { publishedAt: "desc" },
      ...(take ? { take } : {}),
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        excerpt: true,
        content: includeDrafts,
        authorName: true,
        published: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ articles: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  try {
    const body = newsSchema.parse(await req.json());
    let slug = slugify(body.title);
    const existing = await prisma.newsArticle.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const article = await prisma.newsArticle.create({
      data: {
        title: body.title,
        slug,
        category: body.category,
        excerpt: body.excerpt,
        content: body.content,
        authorName: body.authorName || "TechFlare Solutions Admin",
        published: body.published ?? false,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
      },
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}
