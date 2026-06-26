import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { slugify } from "@/lib/utils";

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  tagline: z.string().min(5).optional(),
  description: z.string().min(20).optional(),
  status: z.enum(["live", "in-development", "coming-soon"]).optional(),
  imageUrl: z.string().optional().or(z.literal("")),
  externalUrl: z.string().url().optional().or(z.literal("")),
  features: z.array(z.string()).optional(),
  howItWorks: z.array(z.string()).optional(),
  pricing: z.record(z.union([z.number(), z.string()])).optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
  source: z.enum(["techflare", "innovator"]).optional(),
  innovatorName: z.string().optional(),
  ideaId: z.string().optional().nullable(),
});

function serializeProduct(product: {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: string;
  imageUrl: string | null;
  externalUrl: string | null;
  features: unknown;
  howItWorks: unknown;
  pricing: unknown;
  sortOrder: number;
  published: boolean;
  source: string;
  innovatorName: string | null;
  ideaId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...product,
    image: product.imageUrl || undefined,
    features: Array.isArray(product.features) ? product.features : [],
    howItWorks: Array.isArray(product.howItWorks) ? product.howItWorks : undefined,
    pricing: product.pricing && typeof product.pricing === "object" ? product.pricing : undefined,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isAdmin = verifyAdminApiKey(req);

  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        ...(isAdmin ? {} : { published: true }),
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product: serializeProduct(product) });
  } catch {
    return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
  }
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
      const clash = await prisma.product.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;
      data.slug = slug;
    }

    if (body.imageUrl === "") data.imageUrl = null;
    if (body.externalUrl === "") data.externalUrl = null;
    if (body.ideaId === null) data.ideaId = null;

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    return NextResponse.json({ product: serializeProduct(product) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const { id } = await params;

  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
