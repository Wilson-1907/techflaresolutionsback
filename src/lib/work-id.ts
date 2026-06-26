import type { ExtendedPrisma } from "@/lib/db";

/** Work ID: dept code + join year (2 digits) + sequence — e.g. SW26001 */
export const WORK_ID_PATTERN = /^[A-Z]{2}\d{2}\d{3,}$/;

export function formatWorkId(deptCode: string, joinYear: number, sequence: number): string {
  const code = deptCode.toUpperCase().slice(0, 2);
  const yy = String(joinYear).slice(-2);
  const seq = String(sequence).padStart(3, "0");
  return `${code}${yy}${seq}`;
}

export function parseWorkIdSequence(workId: string, prefix: string): number {
  if (!workId.startsWith(prefix)) return 0;
  const seq = parseInt(workId.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : 0;
}

export async function allocateWorkId(
  prisma: Pick<ExtendedPrisma, "employeeProfile" | "department">,
  departmentId: string,
  joinDate: Date = new Date()
): Promise<string> {
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department?.code) {
    throw new Error("Department code required to generate Work ID");
  }

  const joinYear = joinDate.getFullYear();
  const yy = String(joinYear).slice(-2);
  const prefix = `${department.code.toUpperCase().slice(0, 2)}${yy}`;

  const existing = await prisma.employeeProfile.findMany({
    where: { workId: { startsWith: prefix } },
    select: { workId: true },
  });

  let maxSeq = 0;
  for (const row of existing) {
    maxSeq = Math.max(maxSeq, parseWorkIdSequence(row.workId, prefix));
  }

  return formatWorkId(department.code, joinYear, maxSeq + 1);
}

export async function peekNextWorkId(
  prisma: Pick<ExtendedPrisma, "employeeProfile" | "department">,
  departmentId: string,
  joinDate: Date = new Date()
): Promise<string> {
  return allocateWorkId(prisma, departmentId, joinDate);
}
