import { NextRequest, NextResponse } from "next/server";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import {
  syncPendingWorkflows,
  workflowIncludes,
  notifyUser,
  notifyInternal,
  updateWorkflowStatus,
  attachWorkflowSource,
  notifyHodDepositPaid,
  assignWorkflowToDepartment,
  notifyExecutivesForReview,
  notifyClientWithEmail,
} from "@/lib/workflows";
import { parseWorkflowStages, progressFromStages, sumStageCosts } from "@/lib/workflow-stages";
import { z } from "zod";

export async function GET(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  await syncPendingWorkflows();

  const status = req.nextUrl.searchParams.get("status");
  const clientId = req.nextUrl.searchParams.get("clientId");

  const items = await prisma.serviceWorkflow.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: workflowIncludes(),
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const enriched = await Promise.all(items.map((w) => attachWorkflowSource(w)));

  const pending = enriched.filter((w) =>
    ["PENDING_ADMIN", "ADMIN_APPROVED", "SENT_TO_CIO"].includes(w.status)
  );

  return NextResponse.json({ items: enriched, pendingCount: pending.length });
}

const patchSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "send_to_cio",
    "executive_approve",
    "executive_reject",
    "assign_department",
    "hod_submit_budget",
    "finance_send_to_client",
    "client_agree",
    "record_deposit",
    "start_work",
    "update_progress",
    "notify",
  ]),
  departmentId: z.string().optional(),
  adminNotes: z.string().optional(),
  sendToCio: z.boolean().optional(),
  hodBrief: z.string().optional(),
  hodBudget: z.number().optional(),
  hodStages: z.array(z.object({ title: z.string(), description: z.string().optional(), cost: z.number().optional() })).optional(),
  financeNotes: z.string().optional(),
  financeTotal: z.number().optional(),
  financeStages: z.array(z.object({ title: z.string(), description: z.string().optional(), cost: z.number().optional() })).optional(),
  progress: z.number().min(0).max(100).optional(),
  notifyTitle: z.string().optional(),
  notifyMessage: z.string().optional(),
  notifyDepartmentId: z.string().optional(),
  notifyRecipientId: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Workflow id required" }, { status: 400 });

  try {
    const body = patchSchema.parse(await req.json());
    const workflow = await prisma.serviceWorkflow.findUnique({ where: { id } });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    switch (body.action) {
      case "approve": {
        if (!body.departmentId) {
          return NextResponse.json(
            { error: "Select a department — approval sends the request to that department for review and budget." },
            { status: 400 }
          );
        }
        await assignWorkflowToDepartment(id, body.departmentId, workflow);
        if (body.adminNotes?.trim()) {
          await prisma.serviceWorkflow.update({
            where: { id },
            data: { adminNotes: body.adminNotes.trim() },
          });
        }
        break;
      }
      case "reject": {
        await updateWorkflowStatus(id, "REJECTED", { adminNotes: body.adminNotes });
        if (workflow.type === "idea") {
          await prisma.idea.update({ where: { id: workflow.sourceId }, data: { status: "REJECTED" } });
        } else {
          await prisma.solutionRequest.update({ where: { id: workflow.sourceId }, data: { status: "DECLINED" } });
        }
        if (workflow.clientId) {
          await notifyClientWithEmail(
            workflow.clientId,
            "Submission update",
            "Your submission was not approved at this time. Check your email for details.",
            "Update on your TechFlare submission",
            `<p>Thank you for your submission. After review we are unable to proceed with <strong>${workflow.title}</strong> at this time.</p><p>Sign in to your portal for details: <a href="{{portalUrl}}">{{portalUrl}}</a></p>`,
            `Update on "${workflow.title}": not approved at this time. Portal: {{portalUrl}}`
          );
        }
        break;
      }
      case "send_to_cio": {
        await updateWorkflowStatus(id, "SENT_TO_CIO", {
          adminNotes: body.adminNotes,
          sendToCio: true,
        });
        await notifyExecutivesForReview(workflow);
        if (workflow.type === "idea") {
          await prisma.idea.update({ where: { id: workflow.sourceId }, data: { status: "RESEARCH_REVIEW" } });
        }
        if (workflow.clientId) {
          await notifyClientWithEmail(
            workflow.clientId,
            "Under executive review",
            "Your submission is with our CIO/CTO team for additional review. We will notify you when a decision is made.",
            "Your submission — executive review",
            `<p>Your submission <strong>${workflow.title}</strong> is with our <strong>CIO/CTO</strong> team for additional consultation before we assign a department.</p><p>We will email you when approved. Track status in your portal: <a href="{{portalUrl}}">{{portalUrl}}</a></p>`,
            `"${workflow.title}" is under CIO/CTO review. We will notify you when a decision is made. Portal: {{portalUrl}}`
          );
        }
        break;
      }
      case "executive_approve": {
        if (!body.departmentId) {
          return NextResponse.json({ error: "Select a department for HOD budget and documentation." }, { status: 400 });
        }
        if (workflow.status !== "SENT_TO_CIO") {
          return NextResponse.json({ error: "Workflow is not awaiting executive review" }, { status: 400 });
        }
        await assignWorkflowToDepartment(id, body.departmentId, workflow);
        break;
      }
      case "executive_reject": {
        if (workflow.status !== "SENT_TO_CIO") {
          return NextResponse.json({ error: "Workflow is not awaiting executive review" }, { status: 400 });
        }
        await updateWorkflowStatus(id, "REJECTED", { adminNotes: body.adminNotes });
        if (workflow.type === "idea") {
          await prisma.idea.update({ where: { id: workflow.sourceId }, data: { status: "REJECTED" } });
        } else {
          await prisma.solutionRequest.update({ where: { id: workflow.sourceId }, data: { status: "DECLINED" } });
        }
        if (workflow.clientId) {
          await notifyClientWithEmail(
            workflow.clientId,
            "Submission update",
            "After executive review we are unable to proceed with your submission at this time.",
            "Update on your TechFlare submission",
            `<p>After CIO/CTO review we cannot proceed with <strong>${workflow.title}</strong> at this time.</p><p>Portal: <a href="{{portalUrl}}">{{portalUrl}}</a></p>`,
            `Executive review complete — "${workflow.title}" not proceeding. Portal: {{portalUrl}}`
          );
        }
        break;
      }
      case "assign_department": {
        if (!body.departmentId) return NextResponse.json({ error: "departmentId required" }, { status: 400 });
        await assignWorkflowToDepartment(id, body.departmentId, workflow);
        break;
      }
      case "hod_submit_budget": {
        const stages = parseWorkflowStages(body.hodStages);
        const hodBudget = stages.length > 0 ? sumStageCosts(stages) : body.hodBudget;
        await updateWorkflowStatus(id, "FINANCE_REVIEW", {
          hodBrief: body.hodBrief,
          hodBudget,
          hodStages: stages,
          financeTotal: hodBudget,
          financeStages: stages,
        });
        await notifyInternal({
          title: "Budget ready for finance review",
          message: `${workflow.title} — KES ${(hodBudget ?? 0).toLocaleString()} across ${stages.length} stages`,
        });
        break;
      }
      case "finance_send_to_client": {
        const stages = parseWorkflowStages(body.financeStages ?? workflow.hodStages);
        const total = stages.length > 0 ? sumStageCosts(stages) : body.financeTotal;
        await updateWorkflowStatus(id, "SENT_TO_CLIENT", {
          financeNotes: body.financeNotes,
          financeTotal: total,
          financeStages: stages,
        });
        if (workflow.clientId) {
          await notifyUser(
            workflow.clientId,
            "Proposal & invoice ready",
            "Review the project stages and invoice in your portal. Agree to begin — 60% deposit required to start work."
          );
        }
        break;
      }
      case "client_agree":
        await updateWorkflowStatus(id, "CLIENT_AGREED", { clientAgreed: true, clientAgreedAt: new Date() });
        break;
      case "record_deposit":
        await updateWorkflowStatus(id, "DEPOSIT_PAID", { depositPaid: true, depositPaidAt: new Date() });
        await notifyHodDepositPaid(workflow);
        if (workflow.clientId) {
          await notifyUser(workflow.clientId, "Deposit received", "Your deposit was received. Your HOD will assign the team and start delivery.");
        }
        break;
      case "start_work": {
        const stages = parseWorkflowStages(workflow.financeStages ?? workflow.hodStages);
        await updateWorkflowStatus(id, "WORK_STARTED", {
          workStarted: true,
          workStartedAt: new Date(),
          financeStages: stages,
          progress: progressFromStages(stages),
        });
        if (workflow.clientId) {
          await notifyUser(workflow.clientId, "Work started", "Your project is now in progress. Track each stage in your portal.");
        }
        break;
      }
      case "update_progress":
        if (body.progress === undefined) return NextResponse.json({ error: "progress required" }, { status: 400 });
        await updateWorkflowStatus(id, body.progress >= 100 ? "COMPLETED" : "IN_PROGRESS", { progress: body.progress });
        break;
      case "notify":
        await notifyInternal({
          title: body.notifyTitle || "Admin notice",
          message: body.notifyMessage || "",
          departmentId: body.notifyDepartmentId,
          recipientId: body.notifyRecipientId,
        });
        break;
    }

    const updated = await prisma.serviceWorkflow.findUnique({
      where: { id },
      include: workflowIncludes(),
    });
    const enrichedWorkflow = updated ? await attachWorkflowSource(updated) : null;
    return NextResponse.json({ workflow: enrichedWorkflow });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
