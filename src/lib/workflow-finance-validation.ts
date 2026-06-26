import { parseWorkflowStages, sumStageCosts, type WorkflowStage } from "./workflow-stages";
import type { ExtendedPrisma } from "./db";

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

function fail(errors: string[]): ValidationResult {
  return { ok: false, errors };
}

export function validateDeliveryStages(stages: WorkflowStage[], label = "Stage"): ValidationResult {
  const errors: string[] = [];
  if (stages.length === 0) {
    errors.push("Add at least one stage with title, unit price, quantity, and timeline.");
    return fail(errors);
  }
  stages.forEach((s, i) => {
    const n = `${label} ${i + 1}`;
    if (!s.title?.trim()) errors.push(`${n}: title is required.`);
    if ((s.cost ?? 0) <= 0) errors.push(`${n}: unit price (KES) must be greater than 0.`);
    if ((s.quantity ?? 1) < 1) errors.push(`${n}: quantity must be at least 1.`);
    if (!s.dueDate?.trim()) errors.push(`${n}: timeline (due date) is required.`);
  });
  return errors.length ? fail(errors) : { ok: true };
}

export function validateHodInvoiceDraft(hodBrief: string | undefined, rawStages: unknown): ValidationResult {
  const errors: string[] = [];
  if (!hodBrief?.trim()) {
    errors.push("Scope brief is required for Finance and the client proposal.");
  }
  const stages = parseWorkflowStages(rawStages);
  const stageVal = validateDeliveryStages(stages);
  if (!stageVal.ok) errors.push(...stageVal.errors);
  const total = sumStageCosts(stages);
  if (stages.length > 0 && total <= 0) {
    errors.push("Project total must be greater than 0.");
  }
  return errors.length ? fail(errors) : { ok: true };
}

export function validateFinanceSendReady(params: {
  clientEmail?: string | null;
  financeDocId?: string | null;
  rawStages: unknown;
  depositPercent: number;
  requirePreparedInvoice?: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const stages = parseWorkflowStages(params.rawStages);
  const stageVal = validateDeliveryStages(stages);
  if (!stageVal.ok) errors.push(...stageVal.errors);

  if (!params.clientEmail?.trim()) {
    errors.push("Client email is required — update the client account before sending.");
  }
  if (params.requirePreparedInvoice !== false && !params.financeDocId) {
    errors.push("Prepare the invoice first (step 2) before sending to the client.");
  }
  if (params.depositPercent < 1 || params.depositPercent > 100) {
    errors.push("Deposit % must be between 1 and 100.");
  }
  const total = sumStageCosts(stages);
  if (stages.length > 0 && total <= 0) {
    errors.push("Invoice total must be greater than 0.");
  }
  return errors.length ? fail(errors) : { ok: true };
}

export async function recordProposalEmailAttempt(
  prisma: ExtendedPrisma,
  workflowId: string,
  result: { sent: boolean; error?: string }
) {
  await prisma.serviceWorkflow.update({
    where: { id: workflowId },
    data: {
      emailDeliveryStatus: result.sent ? "sent" : "failed",
      emailLastError: result.sent ? null : result.error ?? "Email failed",
      emailLastAttemptAt: new Date(),
    },
  });
}
