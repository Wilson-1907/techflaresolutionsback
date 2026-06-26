import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { slugify } from "@/lib/utils";

const productSchema = z.object({
  title: z.string().min(3),
  tagline: z.string().min(5),
  description: z.string().min(20),
  status: z.enum(["live", "in-development", "coming-soon"]),
  imageUrl: z.string().optional().or(z.literal("")),
  externalUrl: z.string().url().optional().or(z.literal("")),
  features: z.array(z.string()).default([]),
  howItWorks: z.array(z.string()).optional(),
  pricing: z.record(z.union([z.number(), z.string()])).optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
  source: z.enum(["techflare", "innovator"]).optional(),
  innovatorName: z.string().optional(),
  ideaId: z.string().optional(),
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

export async function GET(req: NextRequest) {
  const includeUnpublished = req.nextUrl.searchParams.get("all") === "true";

  if (includeUnpublished && !verifyAdminApiKey(req)) {
    return adminUnauthorized();
  }

  try {
    const products = await prisma.product.findMany({
      where: includeUnpublished ? undefined : { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({
      products: products.map(serializeProduct),
    });
  } catch {
    return NextResponse.json({ products: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  try {
    const body = productSchema.parse(await req.json());
    let slug = slugify(body.title);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const product = await prisma.product.create({
      data: {
        slug,
        title: body.title,
        tagline: body.tagline,
        description: body.description,
        status: body.status,
        imageUrl: body.imageUrl || null,
        externalUrl: body.externalUrl || null,
        features: body.features,
        howItWorks: body.howItWorks ?? undefined,
        pricing: body.pricing ?? undefined,
        sortOrder: body.sortOrder ?? 0,
        published: body.published ?? true,
        source: body.source ?? "techflare",
        innovatorName: body.innovatorName || null,
        ideaId: body.ideaId || null,
      },
    });

    return NextResponse.json({ product: serializeProduct(product) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
