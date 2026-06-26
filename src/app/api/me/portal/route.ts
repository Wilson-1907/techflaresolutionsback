import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, requireRole } from "@/lib/auth";
import { findWorkflowsCompat, portalUnavailableMessage } from "@/lib/prisma-compat";

const clientWorkflowSelect = {
  id: true,
  type: true,
  sourceId: true,
  status: true,
  projectNumber: true,
  title: true,
  summary: true,
  progress: true,
  hodBrief: true,
  financeTotal: true,
  financeDocId: true,
  depositPercent: true,
  clientAgreed: true,
  clientDeclined: true,
  depositPaid: true,
  workStarted: true,
  workStartedAt: true,
  financeStages: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { name: true } },
} as const;

export async function GET(req: NextRequest) {
  try {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.id;
  const isClient = requireRole(session, ["CLIENT"]);
  const isInnovator = requireRole(session, ["INNOVATOR"]);
  const canBill = isClient || isInnovator;

  if (!isClient && !isInnovator) {
    return NextResponse.json({ error: "Portal access requires client or innovator role" }, { status: 403 });
  }

  const [
    user,
    projects,
    orders,
    solutions,
    tickets,
    notifications,
    ratings,
    blogs,
    ideas,
    mpesaPayments,
    financeDocuments,
    clientWorkflows,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        company: true,
        points: true,
        communityMember: true,
        createdAt: true,
      },
    }),
    isClient
      ? prisma.project.findMany({
          where: { clientId: userId },
          include: {
            milestones: { orderBy: { dueDate: "asc" } },
            invoices: { orderBy: { dueDate: "desc" } },
            documents: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.productOrder.findMany({
      where: { OR: [{ userId }, { customerEmail: session.email }] },
      orderBy: { createdAt: "desc" },
    }),
    isClient
      ? prisma.solutionRequest.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canBill
      ? prisma.supportTicket.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.serviceRating.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.blogPost.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
    }),
    isInnovator
      ? prisma.idea.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.mpesaPayment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    canBill
      ? (async () => {
          const workflowLinks = await prisma.serviceWorkflow.findMany({
            where: {
              clientId: userId,
              OR: [{ financeDocId: { not: null } }, { receiptDocId: { not: null } }],
            },
            select: { financeDocId: true, receiptDocId: true },
          });
          const workflowDocIds = [
            ...new Set(
              workflowLinks.flatMap((w) =>
                [w.financeDocId, w.receiptDocId].filter((id): id is string => Boolean(id))
              )
            ),
          ];
          return prisma.financeDocument.findMany({
            where: {
              OR: [
                { clientEmail: session.email, status: { in: ["sent", "paid"] } },
                {
                  id: { in: workflowDocIds },
                  OR: [
                    { docType: "receipt" },
                    { docType: "invoice", status: { in: ["sent", "paid"] } },
                  ],
                },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          });
        })()
      : Promise.resolve([]),
    canBill
      ? findWorkflowsCompat(
          (args) => prisma.serviceWorkflow.findMany(args),
          {
            where: { clientId: userId },
            select: clientWorkflowSelect,
            orderBy: { updatedAt: "desc" },
          }
        )
      : Promise.resolve([]),
  ]);

  const workflowByInvoiceId = new Map(
    clientWorkflows
      .filter((w) => w.financeDocId)
      .map((w) => [w.financeDocId as string, w])
  );

  const invoices = [
    ...projects.flatMap((p) =>
      p.invoices.map((inv) => ({
        ...inv,
        projectName: p.name,
        source: "project" as const,
        workflowId: null as string | null,
      }))
    ),
    ...financeDocuments
      .filter((d) => d.docType === "invoice")
      .map((d) => {
        const wf = workflowByInvoiceId.get(d.id);
        return {
          id: d.id,
          number: d.number,
          amount: d.total,
          currency: d.currency,
          status: d.status === "paid" ? "paid" : d.status === "sent" ? "pending" : d.status,
          dueDate: d.dueDate ? d.dueDate.toISOString() : null,
          projectName: d.notes?.split("\n")[0] || "Finance Office",
          source: "finance" as const,
          issuerName: d.issuerName,
          issuerTitle: d.issuerTitle,
          paymentMethod: d.paymentMethod,
          lineItems: d.lineItems,
          notes: d.notes,
          signed: true,
          workflowId: wf?.id ?? null,
        };
      }),
  ];

  const receipts = financeDocuments
    .filter((d) => d.docType === "receipt")
    .map((d) => ({
      id: d.id,
      number: d.number,
      amount: d.total,
      currency: d.currency,
      invoiceRef: d.invoiceRef,
      paidAt: d.paidAt ? d.paidAt.toISOString() : null,
      paymentMethod: d.paymentMethod,
      issuerName: d.issuerName,
      issuerTitle: d.issuerTitle,
      signed: true,
    }));
  const documents = projects.flatMap((p) =>
    p.documents.map((doc) => ({
      ...doc,
      projectName: p.name,
    }))
  );

  const activeProjects =
    projects.filter((p) => ["PLANNING", "IN_PROGRESS", "REVIEW"].includes(p.status)).length +
    clientWorkflows.filter((w) =>
      ["WORK_STARTED", "IN_PROGRESS", "DEPOSIT_PAID", "CLIENT_AGREED", "SENT_TO_CLIENT"].includes(w.status)
    ).length;
  const pendingInvoices =
    invoices.filter((i) => i.status === "pending" || i.status === "sent").length;
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const avgRating =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : null;

  const projectsWithSchedule = projects.map((p) => {
    const milestoneProgress =
      p.milestones.length > 0
        ? Math.round(
            (p.milestones.filter((m) => m.completed).length / p.milestones.length) * 100
          )
        : p.progress;
    return {
      ...p,
      progress: milestoneProgress,
      milestones: p.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        completed: m.completed,
        dueDate: m.dueDate ? m.dueDate.toISOString() : null,
      })),
    };
  });

  return NextResponse.json({
    user,
    stats: {
      activeProjects,
      pendingInvoices,
      unreadNotifications,
      points: user?.points ?? 0,
      totalOrders: orders.length,
      totalSolutions: solutions.length,
      totalIdeas: ideas.length,
      avgRatingGiven: avgRating,
      blogsPending: blogs.filter((b) => b.status === "PENDING").length,
      blogsPublished: blogs.filter((b) => b.status === "APPROVED").length,
    },
    projects: projectsWithSchedule,
    workflows: clientWorkflows.map((w) => ({
      ...w,
      workStartedAt: w.workStartedAt ? w.workStartedAt.toISOString() : null,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
    orders,
    solutions,
    invoices,
    receipts,
    tickets,
    documents,
    notifications,
    ratings,
    blogs,
    ideas,
    payments: mpesaPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      phone: p.phone,
      description: p.description,
      accountReference: p.accountReference,
      referenceType: p.referenceType,
      status: p.status,
      mpesaReceiptNumber: p.mpesaReceiptNumber,
      createdAt: p.createdAt.toISOString(),
    })),
    recentActivity: buildActivity(projects, orders, solutions, tickets, ideas, blogs),
  });
  } catch (err) {
    console.error("portal GET:", err);
    return NextResponse.json({ error: portalUnavailableMessage() }, { status: 503 });
  }
}

function buildActivity(
  projects: { name: string; status: string; updatedAt: Date }[],
  orders: { productTitle: string; status: string; createdAt: Date }[],
  solutions: { problem: string; status: string; createdAt: Date }[],
  tickets: { subject: string; status: string; updatedAt: Date }[],
  ideas: { title: string; status: string; createdAt: Date }[],
  blogs: { title: string; status: string; createdAt: Date }[]
) {
  return [
    ...projects.map((p) => ({
      text: `Project "${p.name}" — ${p.status.replace(/_/g, " ")}`,
      date: p.updatedAt,
      type: "project",
    })),
    ...orders.map((o) => ({
      text: `Order: ${o.productTitle} (${o.status})`,
      date: o.createdAt,
      type: "order",
    })),
    ...solutions.map((s) => ({
      text: `Solution request — ${s.status.replace(/_/g, " ")}`,
      date: s.createdAt,
      type: "solution",
    })),
    ...tickets.map((t) => ({
      text: `Support: ${t.subject} (${t.status})`,
      date: t.updatedAt,
      type: "ticket",
    })),
    ...ideas.map((i) => ({
      text: `Idea: ${i.title} (${i.status.replace(/_/g, " ")})`,
      date: i.createdAt,
      type: "idea",
    })),
    ...blogs.map((b) => ({
      text: `Blog "${b.title}" — ${b.status}`,
      date: b.createdAt,
      type: "blog",
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);
}
