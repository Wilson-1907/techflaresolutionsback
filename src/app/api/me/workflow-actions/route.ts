import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateWorkflowStatus, notifyInternal, assignWorkflowToDepartment } from "@/lib/workflows";
import { validateHodInvoiceDraft } from "@/lib/workflow-finance-validation";
import {
  getActiveStages,
  parseWorkflowStages,
  progressFromStages,
  progressFromStagesAndTimeline,
  sumStageCosts,
  withStageDefaults,
  type WorkflowStage,
} from "@/lib/workflow-stages";
import { z } from "zod";

const STAFF_ROLES = ["EMPLOYEE", "HOD", "CIO", "ADMIN"];

const stageSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  cost: z.number().optional(),
  quantity: z.number().min(1).optional(),
  dueDate: z.string().optional().nullable(),
  timeline: z.string().optional().nullable(),
  completed: z.boolean().optional(),
  assignee: z.string().optional().nullable(),
});

const patchSchema = z.object({
  workflowId: z.string(),
  action: z.enum([
    "hod_submit_budget",
    "hod_begin_work",
    "toggle_stage",
    "assign_stage_work",
    "update_progress",
    "finance_send_to_client",
    "executive_approve",
    "executive_reject",
  ]),
  hodBrief: z.string().optional(),
  hodBudget: z.number().optional(),
  hodStages: z.array(stageSchema).optional(),
  financeNotes: z.string().optional(),
  financeTotal: z.number().optional(),
  financeStages: z.array(stageSchema).optional(),
  progress: z.number().min(0).max(100).optional(),
  stageIndex: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
  assignee: z.string().optional(),
  departmentId: z.string().optional(),
  adminNotes: z.string().optional(),
});

async function saveStages(
  workflowId: string,
  workflow: { financeStages?: unknown; hodStages?: unknown },
  stages: WorkflowStage[],
  progress: number
) {
  const useFinance = parseWorkflowStages(workflow.financeStages).length > 0;
  const patch: Record<string, unknown> = {
    progress,
    ...(progress >= 100 ? { status: "COMPLETED" as const } : { status: "IN_PROGRESS" as const }),
  };
  if (useFinance) patch.financeStages = stages;
  else patch.hodStages = stages;

  return prisma.serviceWorkflow.update({
    where: { id: workflowId },
    data: patch,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !STAFF_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await req.json());
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: session.id },
      include: { department: true },
    });

    const workflow = await prisma.serviceWorkflow.findUnique({ where: { id: body.workflowId } });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (profile?.departmentId && workflow.departmentId && profile.departmentId !== workflow.departmentId) {
      if (session.role !== "ADMIN" && session.role !== "CIO") {
        return NextResponse.json({ error: "Not your department" }, { status: 403 });
      }
    }

    switch (body.action) {
      case "hod_submit_budget": {
        if (session.role !== "HOD" && session.role !== "ADMIN" && session.role !== "CIO") {
          return NextResponse.json({ error: "HOD access required" }, { status: 403 });
        }
        if (!["ASSIGNED_TO_DEPT", "CIO_CONFIRMED"].includes(workflow.status)) {
          return NextResponse.json(
            { error: "Project must be assigned to your department before submitting budget" },
            { status: 400 }
          );
        }
        const hodCheck = validateHodInvoiceDraft(body.hodBrief, body.hodStages);
        if (!hodCheck.ok) {
          return NextResponse.json({ error: hodCheck.errors[0], errors: hodCheck.errors }, { status: 400 });
        }
        const stages = withStageDefaults(parseWorkflowStages(body.hodStages));
        const hodBudget = sumStageCosts(stages);
        await updateWorkflowStatus(body.workflowId, "HOD_BUDGET_SUBMITTED", {
          hodBrief: body.hodBrief,
          hodBudget,
          hodStages: stages,
          financeTotal: hodBudget,
          financeStages: stages,
        });
        const financeDept = await prisma.department.findFirst({ where: { slug: "finance" } });
        await notifyInternal({
          title: "First invoice draft — finance review",
          message: `${workflow.title} — HOD submitted invoice stages totalling KES ${hodBudget.toLocaleString()}. Review and send to client if no edits needed.`,
          departmentId: financeDept?.id,
        });
        break;
      }

      case "executive_approve": {
        if (session.role !== "CIO" && session.role !== "ADMIN") {
          return NextResponse.json({ error: "CIO/CTO executive access required" }, { status: 403 });
        }
        if (workflow.status !== "SENT_TO_CIO") {
          return NextResponse.json({ error: "Not awaiting executive review" }, { status: 400 });
        }
        if (!body.departmentId) {
          return NextResponse.json({ error: "Select a department for the HOD to prepare budget" }, { status: 400 });
        }
        await assignWorkflowToDepartment(body.workflowId, body.departmentId, workflow);
        break;
      }

      case "executive_reject": {
        if (session.role !== "CIO" && session.role !== "ADMIN") {
          return NextResponse.json({ error: "CIO/CTO executive access required" }, { status: 403 });
        }
        if (workflow.status !== "SENT_TO_CIO") {
          return NextResponse.json({ error: "Not awaiting executive review" }, { status: 400 });
        }
        await updateWorkflowStatus(body.workflowId, "REJECTED", { adminNotes: body.adminNotes });
        if (workflow.type === "idea") {
          await prisma.idea.update({ where: { id: workflow.sourceId }, data: { status: "REJECTED" } });
        } else {
          await prisma.solutionRequest.update({ where: { id: workflow.sourceId }, data: { status: "DECLINED" } });
        }
        break;
      }

      case "hod_begin_work": {
        if (session.role !== "HOD" && session.role !== "ADMIN" && session.role !== "CIO") {
          return NextResponse.json({ error: "HOD access required" }, { status: 403 });
        }
        if (!["DEPOSIT_PAID"].includes(workflow.status)) {
          return NextResponse.json({ error: "Deposit must be paid before starting work" }, { status: 400 });
        }
        const stages = withStageDefaults(getActiveStages(workflow));
        await updateWorkflowStatus(body.workflowId, "WORK_STARTED", {
          workStarted: true,
          workStartedAt: new Date(),
          financeStages: stages,
          progress: progressFromStages(stages),
        });
        if (workflow.clientId) {
          await prisma.notification.create({
            data: {
              userId: workflow.clientId,
              title: "Work started",
              message: `Your project "${workflow.title}" is in progress. Track each stage in your portal.`,
            },
          });
        }
        break;
      }

      case "toggle_stage": {
        if (body.stageIndex === undefined || body.completed === undefined) {
          return NextResponse.json({ error: "stageIndex and completed required" }, { status: 400 });
        }
        const stages = [...getActiveStages(workflow)];
        if (body.stageIndex >= stages.length) {
          return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
        }
        stages[body.stageIndex] = { ...stages[body.stageIndex], completed: body.completed };
        const progress = progressFromStages(stages);
        const nextStatus =
          progress >= 100 ? "COMPLETED" : workflow.status === "WORK_STARTED" ? "IN_PROGRESS" : workflow.status;
        await saveStages(body.workflowId, workflow, stages, progress);
        if (nextStatus !== workflow.status) {
          await prisma.serviceWorkflow.update({
            where: { id: body.workflowId },
            data: { status: nextStatus },
          });
        }
        if (workflow.clientId) {
          await prisma.notification.create({
            data: {
              userId: workflow.clientId,
              title: "Project progress updated",
              message: `Stage "${stages[body.stageIndex].title}" marked ${body.completed ? "complete" : "in progress"}.`,
            },
          });
        }
        break;
      }

      case "assign_stage_work": {
        if (session.role !== "HOD" && session.role !== "ADMIN" && session.role !== "CIO") {
          return NextResponse.json({ error: "HOD access required" }, { status: 403 });
        }
        if (body.stageIndex === undefined) {
          return NextResponse.json({ error: "stageIndex required" }, { status: 400 });
        }
        const stages = [...getActiveStages(workflow)];
        if (body.stageIndex >= stages.length) {
          return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
        }
        stages[body.stageIndex] = {
          ...stages[body.stageIndex],
          assignee: body.assignee?.trim() || null,
        };
        const useFinance = parseWorkflowStages(workflow.financeStages).length > 0;
        await prisma.serviceWorkflow.update({
          where: { id: body.workflowId },
          data: useFinance ? { financeStages: stages } : { hodStages: stages },
        });
        break;
      }

      case "finance_send_to_client": {
        const isFinance =
          session.role === "ADMIN" ||
          session.role === "CIO" ||
          profile?.department?.slug === "finance";
        if (!isFinance) {
          return NextResponse.json({ error: "Finance access required" }, { status: 403 });
        }
        const stages = withStageDefaults(
          parseWorkflowStages(body.financeStages ?? body.hodStages ?? workflow.hodStages)
        );
        const total = sumStageCosts(stages) || body.financeTotal || workflow.hodBudget || 0;
        await updateWorkflowStatus(body.workflowId, "SENT_TO_CLIENT", {
          financeNotes: body.financeNotes,
          financeTotal: total,
          financeStages: stages,
        });
        break;
      }

      case "update_progress":
        if (body.progress === undefined) {
          return NextResponse.json({ error: "progress required" }, { status: 400 });
        }
        await updateWorkflowStatus(body.workflowId, body.progress >= 100 ? "COMPLETED" : "IN_PROGRESS", {
          progress: body.progress,
        });
        break;
    }

    const updated = await prisma.serviceWorkflow.findUnique({ where: { id: body.workflowId } });
    return NextResponse.json({ workflow: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("[workflow-actions]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
