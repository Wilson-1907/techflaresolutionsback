import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";

const announcementSchema = z.object({
  title: z.string().min(2),
  message: z.string().min(5),
  type: z.enum(["info", "news", "alert", "success"]).optional(),
  link: z.string().url().optional().or(z.literal("")),
  linkLabel: z.string().optional(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
});

function activeWhere() {
  const now = new Date();
  return {
    active: true,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
  };
}

export async function GET(req: NextRequest) {
  const includeAll = req.nextUrl.searchParams.get("all") === "true";

  if (includeAll && !verifyAdminApiKey(req)) {
    return adminUnauthorized();
  }

  const announcements = await prisma.siteAnnouncement.findMany({
    where: includeAll ? undefined : activeWhere(),
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  try {
    const body = announcementSchema.parse(await req.json());
    const announcement = await prisma.siteAnnouncement.create({
      data: {
        title: body.title,
        message: body.message,
        type: body.type ?? "info",
        link: body.link || null,
        linkLabel: body.linkLabel || null,
        active: body.active ?? true,
        startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    });
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
