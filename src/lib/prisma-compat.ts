import type { Prisma } from "@prisma/client";

/** Detect Prisma/Postgres errors when a column or field is missing in the live DB. */
export function isPrismaMissingColumnError(err: unknown, column?: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (!/column|does not exist|Unknown field|Invalid.*invocation/i.test(msg)) {
    return false;
  }
  if (column && !new RegExp(column, "i").test(msg)) {
    return false;
  }
  return true;
}

/** User-safe portal error — never expose schema or infra details. */
export function portalUnavailableMessage(): string {
  return "We could not load your portal right now. Please try again in a few minutes.";
}

type WorkflowFindManyArgs = {
  where?: Prisma.ServiceWorkflowWhereInput;
  select: Prisma.ServiceWorkflowSelect;
  orderBy?: Prisma.ServiceWorkflowOrderByWithRelationInput | Prisma.ServiceWorkflowOrderByWithRelationInput[];
  take?: number;
};

/** Run a workflow query; if projectNumber column is missing, retry without it. */
export async function findWorkflowsCompat<T extends Record<string, unknown>>(
  findMany: (args: WorkflowFindManyArgs) => Promise<T[]>,
  args: WorkflowFindManyArgs
): Promise<Array<T & { projectNumber: string | null }>> {
  try {
    const rows = await findMany(args);
    return rows.map((row) => ({
      ...row,
      projectNumber: (row as { projectNumber?: string | null }).projectNumber ?? null,
    }));
  } catch (err) {
    if (!isPrismaMissingColumnError(err, "projectNumber")) {
      throw err;
    }
    const { projectNumber: _removed, ...selectWithout } = args.select as Record<string, unknown> & {
      projectNumber?: boolean;
    };
    const rows = await findMany({ ...args, select: selectWithout as Prisma.ServiceWorkflowSelect });
    return rows.map((row) => ({ ...row, projectNumber: null }));
  }
}

/** Single workflow by id with projectNumber fallback. */
export async function findWorkflowByIdCompat<T extends Record<string, unknown>>(
  findUnique: (args: { where: { id: string }; select: Prisma.ServiceWorkflowSelect }) => Promise<T | null>,
  id: string,
  select: Prisma.ServiceWorkflowSelect
): Promise<(T & { projectNumber: string | null }) | null> {
  try {
    const row = await findUnique({ where: { id }, select });
    if (!row) return null;
    return {
      ...row,
      projectNumber: (row as { projectNumber?: string | null }).projectNumber ?? null,
    };
  } catch (err) {
    if (!isPrismaMissingColumnError(err, "projectNumber")) {
      throw err;
    }
    const { projectNumber: _removed, ...selectWithout } = select as Record<string, unknown> & {
      projectNumber?: boolean;
    };
    const row = await findUnique({ where: { id }, select: selectWithout as Prisma.ServiceWorkflowSelect });
    if (!row) return null;
    return { ...row, projectNumber: null };
  }
}
