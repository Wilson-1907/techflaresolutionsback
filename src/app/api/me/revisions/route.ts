import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit, validateOrigin } from "@/lib/security";

const schema = z.object({
  targetType: z.enum(["project", "solution", "idea", "order", "workflow"]),
  targetId: z.string().min(1),
  targetTitle: z.string().min(1),
  message: z.string().min(3).max(4000),
});

const REVISION_PREFIX = "Revision |";

function parseRevisionSubject(subject: string) {
  if (!subject.startsWith(REVISION_PREFIX)) return null;
  const parts = subject.slice(REVISION_PREFIX.length).split(" | ");
  return {
    targetType: parts[0] || "unknown",
    targetId: parts[1] || "",
    targetTitle: parts[2] || subject,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rows = await prisma.contactSubmission.findMany({
    where: {
      email: user.email,
      subject: { startsWith: REVISION_PREFIX },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const revisions = rows.map((row) => {
    const parsed = parseRevisionSubject(row.subject);
    return {
      id: row.id,
      targetType: parsed?.targetType ?? "unknown",
      targetId: parsed?.targetId ?? "",
      targetTitle: parsed?.targetTitle ?? row.subject,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ revisions });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 15, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const name = `${user.firstName} ${user.lastName}`.trim();
    const subject = `Revision | ${body.targetType} | ${body.targetId} | ${body.targetTitle}`;

    await prisma.contactSubmission.create({
      data: {
        name,
        email: user.email,
        subject,
        message: body.message,
      },
    });

    await prisma.notification.create({
      data: {
        userId: session.id,
        title: "Revision sent",
        message: `We received your change request for "${body.targetTitle}". Our team will review it soon.`,
      },
    });

    return NextResponse.json({
      message: `Change request received for "${body.targetTitle}". Track status on this page — wait for our team to approve or reject.`,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Please describe what you want changed (at least a few words)." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not send revision" }, { status: 500 });
  }
}
