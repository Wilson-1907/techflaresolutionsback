import type { ExtendedPrisma } from "@/lib/db";
import { isPrismaMissingColumnError } from "@/lib/prisma-compat";

/** TFP/26/06/001 — TechFlare Project number */
export const TFP_PROJECT_PATTERN = /^TFP\/(\d{2}|\d{4})\/\d{2}\/\d+$/;

export function formatProjectNumber(year: number, month: number, sequence: number): string {
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");
  return `TFP/${yy}/${mm}/${seq}`;
}

function monthPrefixes(year: number, month: number): string[] {
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  return [`TFP/${yy}/${mm}/`, `TFP/${year}/${mm}/`];
}

function parseSequence(number: string, prefix: string): number {
  if (!number.startsWith(prefix)) return 0;
  const seq = parseInt(number.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : 0;
}

export async function allocateProjectNumber(
  prisma: Pick<ExtendedPrisma, "serviceWorkflow">,
  docDate: Date = new Date()
): Promise<string> {
  const year = docDate.getFullYear();
  const month = docDate.getMonth() + 1;
  const prefixes = monthPrefixes(year, month);

  const existing = await prisma.serviceWorkflow.findMany({
    where: {
      OR: prefixes.map((prefix) => ({ projectNumber: { startsWith: prefix } })),
    },
    select: { projectNumber: true },
  });

  let maxSeq = 0;
  for (const row of existing) {
    if (!row.projectNumber) continue;
    for (const prefix of prefixes) {
      maxSeq = Math.max(maxSeq, parseSequence(row.projectNumber, prefix));
    }
  }

  return formatProjectNumber(year, month, maxSeq + 1);
}

export async function ensureWorkflowProjectNumber(
  prisma: Pick<ExtendedPrisma, "serviceWorkflow">,
  workflowId: string
): Promise<string> {
  const workflow = await prisma.serviceWorkflow.findUnique({
    where: { id: workflowId },
    select: { projectNumber: true },
  });
  if (workflow?.projectNumber) return workflow.projectNumber;

  const number = await allocateProjectNumber(prisma);
  await prisma.serviceWorkflow.update({
    where: { id: workflowId },
    data: { projectNumber: number },
  });
  return number;
}

export async function syncMissingProjectNumbers(prisma: Pick<ExtendedPrisma, "serviceWorkflow">) {
  try {
    const missing = await prisma.serviceWorkflow.findMany({
      where: { projectNumber: null, departmentId: { not: null } },
      select: { id: true },
      take: 200,
    });
    for (const w of missing) {
      await ensureWorkflowProjectNumber(prisma, w.id);
    }
  } catch (err) {
    if (isPrismaMissingColumnError(err, "projectNumber")) {
      return;
    }
    throw err;
  }
}
