export type WorkflowStage = {
  title: string;
  description?: string;
  cost?: number;
  quantity?: number;
  dueDate?: string | null;
  timeline?: string | null;
  completed?: boolean;
  assignee?: string | null;
};

export function parseWorkflowStages(raw: unknown): WorkflowStage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      title: String(s.title ?? "").trim(),
      description: s.description ? String(s.description) : undefined,
      cost: typeof s.cost === "number" ? s.cost : Number(s.cost) || 0,
      quantity:
        s.quantity == null || s.quantity === ""
          ? 1
          : Math.max(1, typeof s.quantity === "number" ? s.quantity : Number(s.quantity) || 1),
      dueDate: s.dueDate ? String(s.dueDate) : null,
      timeline: s.timeline ? String(s.timeline) : null,
      completed: Boolean(s.completed),
      assignee: s.assignee ? String(s.assignee) : null,
    }))
    .filter((s) => s.title.length > 0);
}

export function stageLineTotal(stage: WorkflowStage): number {
  const qty = stage.quantity ?? 1;
  return (stage.cost ?? 0) * qty;
}

export function sumStageCosts(stages: WorkflowStage[]): number {
  return stages.reduce((sum, s) => sum + stageLineTotal(s), 0);
}

export function progressFromStages(stages: WorkflowStage[]): number {
  if (stages.length === 0) return 0;
  const done = stages.filter((s) => s.completed).length;
  return Math.round((done / stages.length) * 100);
}

/** Progress from stage completion and project timeline (only after work has started). */
export function progressFromStagesAndTimeline(
  stages: WorkflowStage[],
  workStartedAt?: Date | string | null
): number {
  const stagePct = progressFromStages(stages);
  if (!workStartedAt || stages.length === 0) return stagePct;

  const start = new Date(workStartedAt).getTime();
  const dueTimes = stages
    .map((s) => (s.dueDate ? new Date(s.dueDate).getTime() : null))
    .filter((t): t is number => t != null && Number.isFinite(t));

  if (dueTimes.length === 0) return stagePct;

  const end = Math.max(...dueTimes);
  if (end <= start) return stagePct;

  const now = Date.now();
  const timePct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));

  if (stagePct >= 100) return 100;
  return Math.round(stagePct * 0.75 + Math.min(stagePct, timePct) * 0.25);
}

export function shouldShowWorkflowProgress(workflow: {
  depositPaid?: boolean;
  workStarted?: boolean;
  status?: string;
}): boolean {
  if (!workflow.depositPaid) return false;
  return ["DEPOSIT_PAID", "WORK_STARTED", "IN_PROGRESS", "COMPLETED"].includes(workflow.status ?? "");
}

/** Active delivery stages: finance copy after send, else HOD draft. */
export function getActiveStages(workflow: {
  financeStages?: unknown;
  hodStages?: unknown;
}): WorkflowStage[] {
  const finance = parseWorkflowStages(workflow.financeStages);
  if (finance.length > 0) return finance;
  return parseWorkflowStages(workflow.hodStages);
}

export function withStageDefaults(stages: WorkflowStage[]): WorkflowStage[] {
  return stages.map((s) => ({
    ...s,
    completed: s.completed ?? false,
    cost: s.cost ?? 0,
    quantity: s.quantity ?? 1,
  }));
}
