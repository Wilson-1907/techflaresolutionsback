import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { syncPendingWorkflows, attachWorkflowSource } from "@/lib/workflows";
import type { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const type = req.nextUrl.searchParams.get("type") || "overview";

  try {
    switch (type) {
      case "overview":
        return NextResponse.json(await getOverview());
      case "ideas":
        return NextResponse.json({
          items: await prisma.idea.findMany({
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        });
      case "solutions":
        return NextResponse.json({
          items: await prisma.solutionRequest.findMany({
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        });
      case "users": {
        const roleParam = req.nextUrl.searchParams.get("role") || undefined;
        const roles = roleParam?.split(",").filter(Boolean) as UserRole[] | undefined;
        return NextResponse.json({
          items: await prisma.user.findMany({
            where: roles?.length ? { role: { in: roles } } : undefined,
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              company: true,
              phone: true,
              points: true,
              communityMember: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        });
      }
      case "projects":
        return NextResponse.json({
          items: await prisma.project.findMany({
            include: {
              client: { select: { firstName: true, lastName: true, email: true, company: true } },
              invoices: { select: { number: true, amount: true, status: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
          }),
        });
      case "orders":
        return NextResponse.json({
          items: await prisma.productOrder.findMany({
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        });
      case "contacts":
        return NextResponse.json({
          items: await prisma.contactSubmission.findMany({
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        });
      case "careers":
        return NextResponse.json({
          items: await prisma.careerApplication.findMany({
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        });
      case "tickets":
        return NextResponse.json({
          items: await prisma.supportTicket.findMany({
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { updatedAt: "desc" },
            take: 100,
          }),
        });
      case "community":
        return NextResponse.json({
          items: await prisma.user.findMany({
            where: { communityMember: true },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              communityJoinedAt: true,
              createdAt: true,
            },
            orderBy: { communityJoinedAt: "desc" },
            take: 100,
          }),
        });
      case "news":
        return NextResponse.json({
          items: await prisma.newsArticle.findMany({ orderBy: { publishedAt: "desc" }, take: 100 }),
        });
      case "blogs":
        return NextResponse.json({
          items: await prisma.blogPost.findMany({
            include: {
              author: { select: { firstName: true, lastName: true, email: true, role: true, company: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        });
      case "testimonials":
        return NextResponse.json({
          items: await prisma.testimonial.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
        });
      case "pendingApprovals":
        return NextResponse.json(await getPendingApprovals());
      case "workflows":
        return NextResponse.json({
          items: await prisma.serviceWorkflow.findMany({
            include: {
              client: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
              department: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
          }),
        });
      case "clientDetail": {
        const clientId = req.nextUrl.searchParams.get("id");
        if (!clientId) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getClientDetail(clientId));
      }
      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

async function getOverview() {
  const [
    clients,
    innovators,
    admins,
    ideas,
    ideasPending,
    solutions,
    projects,
    orders,
    contacts,
    careers,
    tickets,
    newsPublished,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.count({ where: { role: "INNOVATOR" } }),
    prisma.user.count({ where: { role: { in: ["ADMIN", "EMPLOYEE", "HOD", "CIO"] } } }),
    prisma.idea.count(),
    prisma.idea.count({
      where: { status: { in: ["SUBMITTED", "RESEARCH_REVIEW", "RISK_ASSESSMENT", "FEASIBILITY_ANALYSIS"] } },
    }),
    prisma.solutionRequest.count(),
    prisma.project.count({ where: { status: { in: ["PLANNING", "IN_PROGRESS", "REVIEW"] } } }),
    prisma.productOrder.count(),
    prisma.contactSubmission.count(),
    prisma.careerApplication.count(),
    prisma.supportTicket.count({ where: { status: "open" } }),
    prisma.newsArticle.count({ where: { published: true } }),
  ]);

  const pipeline = await prisma.idea.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  const recentIdeas = await prisma.idea.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { title: true, status: true, createdAt: true },
  });

  const recentOrders = await prisma.productOrder.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { productTitle: true, customerName: true, status: true, createdAt: true },
  });

  return {
    stats: {
      clients,
      innovators,
      admins,
      ideas,
      ideasPending,
      solutions,
      activeProjects: projects,
      orders,
      contacts,
      careers,
      openTickets: tickets,
      newsPublished,
    },
    pipeline: pipeline.map((p) => ({ status: p.status, count: p._count.status })),
    recentActivity: [
      ...recentIdeas.map((i) => ({
        text: `Idea submitted: ${i.title} (${i.status.replace(/_/g, " ")})`,
        date: i.createdAt,
      })),
      ...recentOrders.map((o) => ({
        text: `Product order: ${o.productTitle} by ${o.customerName}`,
        date: o.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8),
    pendingApprovals: await getPendingApprovalsList(),
  };
}

async function getPendingApprovalsList() {
  await syncPendingWorkflows();
  const [rawWorkflows, pendingBlogs, pendingTestimonials, pendingSolutions] = await Promise.all([
    prisma.serviceWorkflow.findMany({
      where: { status: { in: ["PENDING_ADMIN", "SENT_TO_CIO"] } },
      include: {
        client: { select: { firstName: true, lastName: true, email: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.blogPost.count({ where: { status: "PENDING" } }),
    prisma.testimonial.count({ where: { approved: false } }),
    prisma.solutionRequest.count({ where: { status: { in: ["SUBMITTED", "ANALYZING"] } } }),
  ]);
  const workflows = await Promise.all(rawWorkflows.map((w) => attachWorkflowSource(w)));
  return { workflows, pendingBlogs, pendingTestimonials, pendingSolutions };
}

async function getPendingApprovals() {
  return getPendingApprovalsList();
}

async function getClientDetail(clientId: string) {
  const [user, projects, workflows, orders, ideas, solutions, notifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        company: true,
        phone: true,
        points: true,
        createdAt: true,
      },
    }),
    prisma.project.findMany({
      where: { clientId },
      include: { milestones: true, invoices: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.serviceWorkflow.findMany({
      where: { clientId },
      include: { department: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.productOrder.findMany({ where: { userId: clientId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.idea.findMany({ where: { userId: clientId }, orderBy: { createdAt: "desc" } }),
    prisma.solutionRequest.findMany({ where: { userId: clientId }, orderBy: { createdAt: "desc" } }),
    prisma.notification.findMany({ where: { userId: clientId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  if (!user) return { error: "Client not found" };

  return { user, projects, workflows, orders, ideas, solutions, notifications };
}
