import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { requireVerifiedAuth } from "@/lib/api-guard";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { slugify } from "@/lib/utils";

const createSchema = z.object({
  title: z.string().min(5).max(200),
  excerpt: z.string().min(20).max(500),
  content: z.string().min(50),
  coverImage: z.string().url().optional().or(z.literal("")),
  tags: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const isAdmin = verifyAdminApiKey(req);
  const all = req.nextUrl.searchParams.get("all") === "true";
  const mine = req.nextUrl.searchParams.get("mine") === "true";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 20), 50);

  if (mine) {
    try {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const posts = await prisma.blogPost.findMany({
        where: { authorId: session.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          author: { select: { firstName: true, lastName: true, role: true, company: true } },
        },
      });
      return NextResponse.json({ posts });
    } catch {
      return NextResponse.json({ posts: [] });
    }
  }

  try {
    const posts = await prisma.blogPost.findMany({
      where: isAdmin && all ? undefined : { status: "APPROVED" },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: {
        author: { select: { firstName: true, lastName: true, role: true, company: true } },
      },
    });

    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}

export async function POST(req: NextRequest) {
  const isAdmin = verifyAdminApiKey(req);
  let authorId: string;

  if (isAdmin) {
    const session = await getSession();
    if (session) {
      authorId = session.id;
    } else {
      const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "EMPLOYEE"] } } });
      if (!admin) {
        return NextResponse.json({ error: "No admin user in database" }, { status: 500 });
      }
      authorId = admin.id;
    }
  } else {
    const verified = await requireVerifiedAuth();
    if (verified instanceof NextResponse) return verified;
    if (!requireRole(verified.user, ["CLIENT", "INNOVATOR"])) {
      return NextResponse.json({ error: "Only registered clients and innovators can submit blogs" }, { status: 403 });
    }
    authorId = verified.user.id;
  }

  try {
    const raw = await req.json();
    const body = createSchema.parse(raw);

    let slug = slugify(body.title);
    const clash = await prisma.blogPost.findFirst({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const author = await prisma.user.findUnique({ where: { id: authorId } });
    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 400 });
    }

    const post = await prisma.blogPost.create({
      data: {
        title: body.title,
        slug,
        excerpt: body.excerpt,
        content: body.content,
        coverImage: body.coverImage || null,
        tags: body.tags || null,
        status: isAdmin ? "APPROVED" : "PENDING",
        authorId,
        authorRole: author.role,
        publishedAt: isAdmin ? new Date() : null,
      },
      include: {
        author: { select: { firstName: true, lastName: true, role: true, company: true } },
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 });
  }
}
