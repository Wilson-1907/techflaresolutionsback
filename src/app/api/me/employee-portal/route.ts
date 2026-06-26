import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncMissingProjectNumbers } from "@/lib/project-number";
import {
  findWorkflowByIdCompat,
  findWorkflowsCompat,
  portalUnavailableMessage,
} from "@/lib/prisma-compat";

const STAFF_ROLES = ["EMPLOYEE", "HOD", "CIO", "ADMIN"];

const workflowSelect = {
  id: true,
  projectNumber: true,
  type: true,
  title: true,
  summary: true,
  status: true,
  progress: true,
  hodBrief: true,
  hodBudget: true,
  hodStages: true,
  financeNotes: true,
  financeTotal: true,
  financeStages: true,
  financeDocId: true,
  receiptDocId: true,
  depositPaid: true,
  depositPaidAt: true,
  workStarted: true,
  workStartedAt: true,
  clientAgreed: true,
  clientAgreedAt: true,
  clientDeclined: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { firstName: true, lastName: true, email: true } },
  department: { select: { name: true, code: true } },
} as const;

type WorkflowRow = {
  financeDocId: string | null;
  receiptDocId?: string | null;
  title?: string;
  projectNumber?: string | null;
  id?: string;
  [key: string]: unknown;
};

async function attachFinanceInfo<T extends WorkflowRow>(workflows: T[]) {
  const docIds = [
    ...new Set(
      workflows.flatMap((w) => [w.financeDocId, w.receiptDocId].filter((id): id is string => Boolean(id)))
    ),
  ];

  const docs =
    docIds.length === 0
      ? []
      : await prisma.financeDocument.findMany({
          where: { id: { in: docIds } },
          select: {
            id: true,
            docType: true,
            number: true,
            status: true,
            total: true,
            docDate: true,
            paidAt: true,
            invoiceRef: true,
            paymentMethod: true,
          },
        });
  const byId = new Map(docs.map((d) => [d.id, d]));

  return workflows.map((w) => {
    const invoiceDoc = w.financeDocId ? byId.get(w.financeDocId) ?? null : null;
    const receiptDoc = w.receiptDocId ? byId.get(w.receiptDocId) ?? null : null;
    return {
      ...w,
      invoice:
        invoiceDoc && invoiceDoc.docType === "invoice"
          ? {
              id: invoiceDoc.id,
              number: invoiceDoc.number,
              status: invoiceDoc.status,
              total: invoiceDoc.total,
              docDate: invoiceDoc.docDate,
            }
          : null,
      receipt:
        receiptDoc && receiptDoc.docType === "receipt"
          ? {
              id: receiptDoc.id,
              number: receiptDoc.number,
              status: receiptDoc.status,
              total: receiptDoc.total,
              docDate: receiptDoc.docDate,
              paidAt: receiptDoc.paidAt,
              invoiceRef: receiptDoc.invoiceRef,
              paymentMethod: receiptDoc.paymentMethod,
            }
          : null,
    };
  });
}

function buildDepartmentBillingLists(
  workflows: Array<{
    id: string;
    title: string;
    projectNumber: string | null;
    depositPaid: boolean;
    depositPaidAt: Date | null;
    client?: { firstName: string; lastName: string } | null;
    invoice: {
      id: string;
      number: string;
      status: string;
      total: number;
      docDate: Date;
    } | null;
    receipt: {
      id: string;
      number: string;
      total: number;
      paidAt: Date | null;
      invoiceRef: string | null;
      paymentMethod: string | null;
      docDate: Date;
    } | null;
  }>
) {
  const invoices = workflows
    .filter((w) => w.invoice)
    .map((w) => ({
      ...w.invoice!,
      workflowId: w.id,
      projectTitle: w.title,
      projectNumber: w.projectNumber,
      clientName: w.client ? `${w.client.firstName} ${w.client.lastName}` : null,
      docDate: w.invoice!.docDate.toISOString(),
    }))
    .sort((a, b) => new Date(b.docDate).getTime() - new Date(a.docDate).getTime());

  const receipts = workflows
    .filter((w) => w.receipt)
    .map((w) => ({
      ...w.receipt!,
      workflowId: w.id,
      projectTitle: w.title,
      projectNumber: w.projectNumber,
      clientName: w.client ? `${w.client.firstName} ${w.client.lastName}` : null,
      paidAt: w.receipt!.paidAt?.toISOString() ?? null,
      docDate: w.receipt!.docDate.toISOString(),
    }))
    .sort((a, b) => new Date(b.docDate).getTime() - new Date(a.docDate).getTime());

  const depositEvents = workflows
    .filter((w) => w.depositPaid)
    .map((w) => ({
      workflowId: w.id,
      projectTitle: w.title,
      projectNumber: w.projectNumber,
      clientName: w.client ? `${w.client.firstName} ${w.client.lastName}` : null,
      paidAt: w.depositPaidAt?.toISOString() ?? null,
      invoiceNumber: w.invoice?.number ?? null,
      receiptNumber: w.receipt?.number ?? null,
      amount: w.receipt?.total ?? w.invoice?.total ?? null,
    }))
    .sort((a, b) => {
      const ta = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const tb = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return tb - ta;
    });

  return { invoices, receipts, depositEvents };
}

async function canAccessWorkflow(
  workflowId: string,
  session: { id: string; role: string },
  departmentId: string | null | undefined
) {
  const workflow = await prisma.serviceWorkflow.findUnique({
    where: { id: workflowId },
    select: { departmentId: true },
  });
  if (!workflow) return false;
  if (session.role === "ADMIN" || session.role === "CIO") return true;
  return Boolean(departmentId && workflow.departmentId === departmentId);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !STAFF_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await syncMissingProjectNumbers(prisma).catch((err) => {
      console.error("syncMissingProjectNumbers:", err);
    });

    const projectId = req.nextUrl.searchParams.get("projectId");

  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: session.id },
    include: { department: true },
  });

  if (projectId) {
    const allowed = await canAccessWorkflow(projectId, session, profile?.departmentId);
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const workflow = await findWorkflowByIdCompat(
      (args) => prisma.serviceWorkflow.findUnique(args),
      projectId,
      workflowSelect
    );
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [enriched] = await attachFinanceInfo([workflow]);
    return NextResponse.json({ user: session, profile, project: enriched });
  }

  const deptFilter = profile?.departmentId ? { departmentId: profile.departmentId } : {};

  const isExecutive = session.role === "CIO" || session.role === "ADMIN";

  const [notifications, departmentWorkflows, completedWorkflows, activeWorkflows, executiveReviewQueue, budgetQueue] =
    await Promise.all([
    prisma.internalNotification.findMany({
      where: {
        OR: [
          { recipientId: session.id },
          ...(profile?.departmentId ? [{ departmentId: profile.departmentId, recipientId: null }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    profile?.departmentId
      ? findWorkflowsCompat(
          (args) => prisma.serviceWorkflow.findMany(args),
          {
            where: { departmentId: profile.departmentId },
            select: workflowSelect,
            orderBy: { updatedAt: "desc" },
            take: 50,
          }
        )
      : Promise.resolve([]),
    profile?.departmentId
      ? findWorkflowsCompat(
          (args) => prisma.serviceWorkflow.findMany(args),
          {
            where: { ...deptFilter, status: "COMPLETED" },
            select: workflowSelect,
            orderBy: { updatedAt: "desc" },
            take: 30,
          }
        )
      : Promise.resolve([]),
    profile?.departmentId
      ? findWorkflowsCompat(
          (args) => prisma.serviceWorkflow.findMany(args),
          {
            where: {
              ...deptFilter,
              status: { in: ["WORK_STARTED", "IN_PROGRESS", "DEPOSIT_PAID"] },
            },
            select: workflowSelect,
            orderBy: { updatedAt: "desc" },
            take: 30,
          }
        )
      : Promise.resolve([]),
    isExecutive
      ? findWorkflowsCompat(
          (args) => prisma.serviceWorkflow.findMany(args),
          {
            where: { status: "SENT_TO_CIO" },
            select: workflowSelect,
            orderBy: { updatedAt: "desc" },
            take: 30,
          }
        )
      : Promise.resolve([]),
    profile?.departmentId && (session.role === "HOD" || profile.isHod)
      ? findWorkflowsCompat(
          (args) => prisma.serviceWorkflow.findMany(args),
          {
            where: { departmentId: profile.departmentId, status: "ASSIGNED_TO_DEPT" },
            select: workflowSelect,
            orderBy: { updatedAt: "desc" },
            take: 30,
          }
        )
      : Promise.resolve([]),
  ]);

  const [enrichedDept, enrichedCompleted, enrichedActive, enrichedExecutive, enrichedBudget] = await Promise.all([
    attachFinanceInfo(departmentWorkflows),
    attachFinanceInfo(completedWorkflows),
    attachFinanceInfo(activeWorkflows),
    attachFinanceInfo(executiveReviewQueue),
    attachFinanceInfo(budgetQueue),
  ]);

  const billing = buildDepartmentBillingLists(enrichedDept);

  const departments =
    isExecutive
      ? await prisma.department.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  return NextResponse.json({
    user: session,
    profile,
    notifications,
    departments,
    departmentWorkflows: enrichedDept,
    completedWorkflows: enrichedCompleted,
    activeWorkflows: enrichedActive,
    executiveReviewQueue: enrichedExecutive,
    budgetQueue: enrichedBudget,
    invoices: billing.invoices,
    receipts: billing.receipts,
    depositEvents: billing.depositEvents,
  });
  } catch (err) {
    console.error("employee-portal GET:", err);
    return NextResponse.json({ error: portalUnavailableMessage() }, { status: 503 });
  }
}
