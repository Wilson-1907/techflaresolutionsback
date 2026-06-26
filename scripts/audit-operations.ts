/**
 * Audit clients, workflows, and stuck pipeline items.
 * Run: npx tsx --env-file=.env scripts/audit-operations.ts
 */
import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient, WorkflowStatus } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

ensureDatabaseUrl();
const prisma = new PrismaClient();

const STUCK_BEFORE_FINANCE: WorkflowStatus[] = [
  "PENDING_ADMIN",
  "ADMIN_APPROVED",
  "SENT_TO_CIO",
  "CIO_CONFIRMED",
  "ASSIGNED_TO_DEPT",
];

const STUCK_CLIENT_SIDE: WorkflowStatus[] = ["SENT_TO_CLIENT", "CLIENT_AGREED"];

const STATUS_OWNER: Record<WorkflowStatus, string> = {
  PENDING_ADMIN: "Admin — review in Approvals queue",
  ADMIN_APPROVED: "Admin — assign department or send to CIO",
  SENT_TO_CIO: "CIO — confirm scope",
  CIO_CONFIRMED: "Admin — assign department",
  ASSIGNED_TO_DEPT: "HOD — submit budget & stages (Employee portal)",
  HOD_BUDGET_SUBMITTED: "Finance — review budget (Finance panel /workflows)",
  FINANCE_REVIEW: "Finance — send invoice + stages to client",
  SENT_TO_CLIENT: "Client — agree in portal",
  CLIENT_AGREED: "Client — pay 60% M-Pesa deposit",
  DEPOSIT_PAID: "Finance — record deposit & start work",
  WORK_STARTED: "Dev team — update progress (Employee portal)",
  IN_PROGRESS: "Dev team — update progress",
  COMPLETED: "Done",
  REJECTED: "Closed",
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

async function main() {
  const [clients, innovators, workflows, employees, departments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CLIENT" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { workflowsManaged: true, solutions: true, ideas: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "INNOVATOR" },
      select: { id: true, email: true, firstName: true, lastName: true, emailVerified: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.serviceWorkflow.findMany({
      include: {
        client: { select: { email: true, firstName: true, lastName: true } },
        department: { select: { name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.employeeProfile.findMany({
      where: { active: true },
      include: {
        user: { select: { email: true, firstName: true, lastName: true, role: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.department.findMany({ select: { id: true, name: true, slug: true } }),
  ]);

  const active = workflows.filter((w) => !["COMPLETED", "REJECTED"].includes(w.status));
  const stuck = active.filter((w) => STUCK_BEFORE_FINANCE.includes(w.status) || STUCK_CLIENT_SIDE.includes(w.status));

  const byStatus = workflows.reduce(
    (acc, w) => {
      acc[w.status] = (acc[w.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalClients: clients.length,
      unverifiedClients: clients.filter((c) => !c.emailVerified).length,
      totalWorkflows: workflows.length,
      activeWorkflows: active.length,
      stuckWorkflows: stuck.length,
      employees: employees.length,
      departments: departments.length,
      byStatus,
    },
    clients: clients.map((c) => ({
      name: `${c.firstName} ${c.lastName}`,
      email: c.email,
      company: c.company,
      verified: c.emailVerified,
      workflows: c._count.workflowsManaged,
      submissions: c._count.solutions + c._count.ideas,
      joined: fmtDate(c.createdAt),
    })),
    innovators: innovators.map((u) => ({
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      verified: u.emailVerified,
    })),
    activeWorkflows: active.map((w) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      status: w.status,
      owner: STATUS_OWNER[w.status],
      client: w.client ? `${w.client.firstName} ${w.client.lastName} <${w.client.email}>` : "—",
      department: w.department?.name ?? "—",
      progress: w.progress,
      financeTotal: w.financeTotal,
      depositPaid: w.depositPaid,
      clientAgreed: w.clientAgreed,
      updated: fmtDate(w.updatedAt),
    })),
    stuckWorkflows: stuck.map((w) => ({
      id: w.id,
      title: w.title,
      status: w.status,
      nextAction: STATUS_OWNER[w.status],
      client: w.client?.email ?? "—",
      department: w.department?.name ?? "—",
      daysSinceUpdate: Math.floor((Date.now() - w.updatedAt.getTime()) / 86400000),
    })),
    employees: employees.map((e) => ({
      workId: e.workId,
      name: `${e.user.firstName} ${e.user.lastName}`,
      role: e.user.role,
      position: e.position,
      department: e.department?.name ?? "—",
      isHod: e.isHod,
    })),
    departments,
  };

  const outPath = join(process.cwd(), "scripts", "audit-operations-latest.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n=== TechFlare Operations Audit ===\n");
  console.log(`Clients: ${report.summary.totalClients} (${report.summary.unverifiedClients} unverified)`);
  console.log(`Workflows: ${report.summary.totalWorkflows} total, ${report.summary.activeWorkflows} active, ${report.summary.stuckWorkflows} need action`);
  console.log("\nBy status:");
  for (const [status, count] of Object.entries(byStatus).sort()) {
    console.log(`  ${status}: ${count}`);
  }
  if (stuck.length) {
    console.log("\n--- Stuck / waiting ---");
    for (const s of report.stuckWorkflows) {
      console.log(`  [${s.status}] ${s.title} — ${s.nextAction} (${s.daysSinceUpdate}d idle)`);
    }
  } else {
    console.log("\nNo stuck workflows in pipeline.");
  }
  console.log(`\nFull report: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
