import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";

const updateSchema = z.object({
  title: z.string().min(2).optional(),
  message: z.string().min(5).optional(),
  type: z.enum(["info", "news", "alert", "success"]).optional(),
  link: z.string().url().optional().or(z.literal("")).nullable(),
  linkLabel: z.string().optional().nullable(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const { id } = await params;

  try {
    const body = updateSchema.parse(await req.json());
    const announcement = await prisma.siteAnnouncement.update({
      where: { id },
      data: {
        ...body,
        link: body.link === "" ? null : body.link,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt === null ? null : body.endsAt ? new Date(body.endsAt) : undefined,
      },
    });
    return NextResponse.json({ announcement });
  } catch {
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();
  const { id } = await params;

  try {
    await prisma.siteAnnouncement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
