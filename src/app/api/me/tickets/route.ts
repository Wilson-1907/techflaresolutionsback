import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { rateLimit, validateOrigin } from "@/lib/security";

const schema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(4000),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const session = await getSession();
  if (!session || !requireRole(session, ["CLIENT"])) {
    return NextResponse.json({ error: "Client sign-in required" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.id,
        subject: body.subject,
        message: body.message,
        priority: body.priority ?? "medium",
        status: "open",
      },
    });

    await prisma.notification.create({
      data: {
        userId: session.id,
        title: "Support ticket received",
        message: `Ticket "${body.subject}" is open. Our team will reply through your portal and email.`,
      },
    });

    return NextResponse.json({
      message: "Your support ticket was received. Track it below and wait for our team to respond.",
      ticketId: ticket.id,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Please add a clear subject and message (at least 10 characters)." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not create ticket" }, { status: 500 });
  }
}
