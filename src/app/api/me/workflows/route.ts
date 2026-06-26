import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateWorkflowStatus, notifyUser, notifyInternal } from "@/lib/workflows";
import { company } from "@/data/site";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !["CLIENT", "INNOVATOR"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflows = await prisma.serviceWorkflow.findMany({
    where: {
      clientId: session.id,
      status: {
        in: [
          "SENT_TO_CLIENT",
          "CLIENT_AGREED",
          "DEPOSIT_PAID",
          "WORK_STARTED",
          "IN_PROGRESS",
          "COMPLETED",
          "REJECTED",
        ],
      },
    },
    include: { department: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ workflows });
}

const actionSchema = z.object({
  workflowId: z.string(),
  action: z.enum(["agree", "decline", "care"]),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !["CLIENT", "INNOVATOR"].includes(session.role)) {
    return NextResponse.json(
      { error: "Please sign in to your client or innovator portal to respond." },
      { status: 401 }
    );
  }

  try {
    const raw = await req.json();
    const parsed =
      raw.action != null
        ? actionSchema.parse(raw)
        : { workflowId: z.string().parse(raw.workflowId), action: "agree" as const, reason: undefined };
    const { workflowId, action, reason } = parsed;
    const workflow = await prisma.serviceWorkflow.findFirst({
      where: { id: workflowId, clientId: session.id, status: "SENT_TO_CLIENT" },
      include: { department: true },
    });
    if (!workflow) {
      return NextResponse.json({ error: "Proposal not available for response" }, { status: 400 });
    }

    if (action === "agree") {
      await updateWorkflowStatus(workflowId, "CLIENT_AGREED", {
        clientAgreed: true,
        clientAgreedAt: new Date(),
      });

      const financeDept = await prisma.department.findFirst({ where: { slug: "finance" } });
      await notifyInternal({
        title: "Client agreed to proposal",
        message: `${session.firstName} ${session.lastName} agreed to stages and invoice for: ${workflow.title}. Awaiting ${workflow.depositPercent ?? 60}% deposit.`,
        departmentId: financeDept?.id,
      });
      if (workflow.departmentId) {
        await notifyInternal({
          title: "Client agreed — awaiting deposit",
          message: `${session.firstName} agreed to "${workflow.title}". Finance will confirm payment before you begin work.`,
          departmentId: workflow.departmentId,
        });
      }

      return NextResponse.json({
        message: "Agreement recorded. Enter your Safaricom number below to receive the M-Pesa payment prompt.",
        nextStep: "mpesa",
      });
    }

    if (action === "decline") {
      await updateWorkflowStatus(workflowId, "REJECTED", {
        clientDeclined: true,
        clientDeclineReason: reason?.trim() || "Client declined the proposal",
      });

      const financeDept = await prisma.department.findFirst({ where: { slug: "finance" } });
      await notifyInternal({
        title: "Client declined proposal",
        message: `${session.firstName} declined "${workflow.title}".${reason ? ` Reason: ${reason}` : ""}`,
        departmentId: financeDept?.id,
      });
      if (workflow.departmentId) {
        await notifyInternal({
          title: "Client declined proposal",
          message: `${session.firstName} declined "${workflow.title}".${reason ? ` Reason: ${reason}` : ""}`,
          departmentId: workflow.departmentId,
        });
      }

      return NextResponse.json({ message: "We have recorded your decision. This project will not proceed." });
    }

    // care — questions before deciding
    await prisma.supportTicket.create({
      data: {
        userId: session.id,
        subject: `Question about proposal: ${workflow.title}`,
        message:
          reason?.trim() ||
          `Client has questions about the proposal and invoice for "${workflow.title}" before agreeing.`,
        status: "open",
        priority: "medium",
      },
    });

    const financeDept = await prisma.department.findFirst({ where: { slug: "finance" } });
    await notifyInternal({
      title: "Client needs customer care",
      message: `${session.firstName} has questions about "${workflow.title}" before agreeing.${reason ? ` Note: ${reason}` : ""}`,
      departmentId: financeDept?.id,
    });
    if (workflow.departmentId) {
      await notifyInternal({
        title: "Client needs customer care",
        message: `${session.firstName} has questions about "${workflow.title}".${reason ? ` Note: ${reason}` : ""}`,
        departmentId: workflow.departmentId,
      });
    }

    return NextResponse.json({
      message: `Our customer care team has been notified. Call or WhatsApp ${company.phone} — we are here to help.`,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not record response" }, { status: 500 });
  }
}
