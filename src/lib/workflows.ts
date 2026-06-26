import { prisma } from "./db";
import type { WorkflowStatus } from "@prisma/client";
import {
  createDepositReceipt,
  sendWorkflowReceiptEmail,
} from "./workflow-finance";

export async function createWorkflowFromIdea(ideaId: string) {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: { user: true },
  });
  if (!idea) return null;

  const existing = await prisma.serviceWorkflow.findFirst({
    where: { type: "idea", sourceId: ideaId },
  });
  if (existing) return existing;

  return prisma.serviceWorkflow.create({
    data: {
      type: "idea",
      sourceId: ideaId,
      title: idea.title,
      summary: idea.description,
      clientId: idea.userId,
      status: "PENDING_ADMIN",
    },
  });
}

export async function createWorkflowFromSolution(solutionId: string) {
  const solution = await prisma.solutionRequest.findUnique({
    where: { id: solutionId },
    include: { user: true },
  });
  if (!solution) return null;

  const existing = await prisma.serviceWorkflow.findFirst({
    where: { type: "solution", sourceId: solutionId },
  });
  if (existing) return existing;

  return prisma.serviceWorkflow.create({
    data: {
      type: "solution",
      sourceId: solutionId,
      title: solution.problem.slice(0, 120),
      summary: solution.problem,
      clientId: solution.userId ?? undefined,
      status: "PENDING_ADMIN",
    },
  });
}

export async function notifyUser(userId: string, title: string, message: string) {
  await prisma.notification.create({ data: { userId, title, message } });
}

export async function notifyClientWithEmail(
  clientId: string | null | undefined,
  title: string,
  message: string,
  emailSubject: string,
  emailHtml: string,
  emailText: string
) {
  if (!clientId) return;
  await notifyUser(clientId, title, message);
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { email: true, firstName: true },
  });
  if (!client?.email) return;
  const { sendEmail } = await import("./email");
  const { getAppUrl } = await import("./env");
  const portalUrl = `${getAppUrl()}/portal`;
  await sendEmail(
    client.email,
    emailSubject,
    emailHtml.replace("{{portalUrl}}", portalUrl),
    emailText.replace("{{portalUrl}}", portalUrl)
  );
}

export async function notifyExecutivesForReview(workflow: { id: string; title: string; summary?: string }) {
  const executives = await prisma.user.findMany({
    where: { role: { in: ["CIO", "ADMIN"] } },
    select: { id: true },
  });
  const ctoProfiles = await prisma.employeeProfile.findMany({
    where: { position: { contains: "CTO", mode: "insensitive" }, active: true },
    select: { userId: true },
  });
  const recipientIds = new Set([
    ...executives.map((u) => u.id),
    ...ctoProfiles.map((p) => p.userId),
  ]);
  for (const recipientId of recipientIds) {
    await notifyInternal({
      title: "Executive review required",
      message: `"${workflow.title}" needs CIO/CTO review before department assignment and HOD budgeting.`,
      recipientId,
    });
  }
}

export async function assignWorkflowToDepartment(
  workflowId: string,
  departmentId: string,
  workflow: { title: string; type: string; sourceId: string; clientId: string | null }
) {
  const { ensureWorkflowProjectNumber } = await import("./project-number");
  const projectNumber = await ensureWorkflowProjectNumber(prisma, workflowId);
  await updateWorkflowStatus(workflowId, "ASSIGNED_TO_DEPT", { departmentId });
  await prisma.serviceWorkflow.update({ where: { id: workflowId }, data: { projectNumber } });
  await notifyInternal({
    title: "New project — prepare scope & budget",
    message: `${workflow.title} · Project ${projectNumber}. Review, audit scope, and submit budget documentation to Finance.`,
    departmentId,
  });
  if (workflow.type === "idea") {
    await prisma.idea.update({ where: { id: workflow.sourceId }, data: { status: "APPROVED" } });
  } else {
    await prisma.solutionRequest.update({ where: { id: workflow.sourceId }, data: { status: "PROPOSAL_SENT" } });
  }
  const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
  const deptName = dept?.name ?? "your assigned department";
  await notifyClientWithEmail(
    workflow.clientId,
    "Your submission was accepted",
    `TechFlare accepted your request. ${deptName} is reviewing scope and budget. Please wait for Finance to email your invoice and project document — you will be notified in your portal.`,
    "Your idea was accepted — next steps from TechFlare Solutions",
    `<p>Dear client,</p><p>Great news — <strong>TechFlare has accepted your submission</strong> (${workflow.title}).</p><p><strong>${deptName}</strong> is now reviewing and auditing the scope and budget. You do not need to pay yet.</p><p>Finance will send your <strong>invoice and signed project document</strong> when ready. Watch your email and your portal at <a href="{{portalUrl}}">{{portalUrl}}</a>.</p><p>Thank you for choosing TechFlare Solutions.</p>`,
    `Your submission "${workflow.title}" was accepted. ${deptName} is preparing scope and budget. Finance will send your invoice and project document — check your portal: {{portalUrl}}`
  );
  return projectNumber;
}

export async function notifyInternal(params: {
  title: string;
  message: string;
  recipientId?: string;
  departmentId?: string;
  senderId?: string;
}) {
  await prisma.internalNotification.create({ data: params });
}

export async function syncPendingWorkflows() {
  const pendingIdeas = await prisma.idea.findMany({
    where: { status: { in: ["SUBMITTED", "RESEARCH_REVIEW", "RISK_ASSESSMENT", "FEASIBILITY_ANALYSIS"] } },
    select: { id: true },
  });
  for (const idea of pendingIdeas) {
    await createWorkflowFromIdea(idea.id);
  }

  const pendingSolutions = await prisma.solutionRequest.findMany({
    where: { status: { in: ["SUBMITTED", "ANALYZING"] } },
    select: { id: true },
  });
  for (const s of pendingSolutions) {
    await createWorkflowFromSolution(s.id);
  }
}

export function workflowIncludes() {
  return {
    client: { select: { id: true, firstName: true, lastName: true, email: true, company: true, role: true } },
    department: { select: { id: true, name: true, slug: true } },
  };
}

export async function attachWorkflowSource<T extends { type: string; sourceId: string }>(workflow: T) {
  if (workflow.type === "idea") {
    const idea = await prisma.idea.findUnique({
      where: { id: workflow.sourceId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
    });
    return { ...workflow, source: idea ? { kind: "idea" as const, data: idea } : null };
  }
  if (workflow.type === "solution") {
    const solution = await prisma.solutionRequest.findUnique({
      where: { id: workflow.sourceId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, company: true } } },
    });
    return { ...workflow, source: solution ? { kind: "solution" as const, data: solution } : null };
  }
  return { ...workflow, source: null };
}

export async function updateWorkflowStatus(id: string, status: WorkflowStatus, extra?: Record<string, unknown>) {
  return prisma.serviceWorkflow.update({
    where: { id },
    data: { status, ...extra, updatedAt: new Date() },
    include: workflowIncludes(),
  });
}

/** When client pays invoice (M-Pesa), advance workflow, create receipt, alert HOD. */
export async function markWorkflowDepositPaidByFinanceDoc(
  financeDocumentId: string,
  payment?: { amount: number; mpesaReceiptNumber?: string | null }
) {
  const workflow = await prisma.serviceWorkflow.findFirst({
    where: { financeDocId: financeDocumentId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!workflow || workflow.depositPaid) return workflow;

  await updateWorkflowStatus(workflow.id, "DEPOSIT_PAID", {
    depositPaid: true,
    depositPaidAt: new Date(),
  });

  const payAmount = payment?.amount ?? 0;
  if (payAmount > 0 && payment) {
    try {
      const receipt = await createDepositReceipt(workflow, payment);
      if (receipt) {
        await sendWorkflowReceiptEmail(workflow, receipt).catch((err) => {
          console.error("sendWorkflowReceiptEmail:", err);
        });
      }
    } catch (err) {
      console.error("createDepositReceipt:", err);
    }
  }

  if (workflow.departmentId) {
    await notifyInternal({
      title: "Deposit paid — start work",
      message: `"${workflow.title}" — client deposit received and receipt sent. Divide stages among your team and begin work.`,
      departmentId: workflow.departmentId,
    });
  }

  if (workflow.clientId) {
    await notifyUser(
      workflow.clientId,
      "Deposit received",
      "Your deposit was received and a signed receipt is in your portal. Your HOD will assign the team and start delivery."
    );
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "CIO"] } },
    select: { id: true },
  });
  for (const admin of admins) {
    await notifyUser(
      admin.id,
      "Client deposit paid",
      `"${workflow.title}" — deposit received and receipt sent. HOD can begin project work.`
    );
  }

  const financeDept = await prisma.department.findFirst({ where: { slug: "finance" } });
  if (financeDept?.id) {
    await notifyInternal({
      title: "Deposit confirmed — receipt sent",
      message: `"${workflow.title}" — client deposit verified. Receipt emailed; HOD notified to start work.`,
      departmentId: financeDept.id,
    });
  }

  return workflow;
}

export async function notifyHodDepositPaid(workflow: { id: string; title: string; departmentId: string | null }) {
  if (!workflow.departmentId) return;
  await notifyInternal({
    title: "Deposit paid — assign work",
    message: `"${workflow.title}" — deposit received. Divide stages among your team and begin work.`,
    departmentId: workflow.departmentId,
  });
}
