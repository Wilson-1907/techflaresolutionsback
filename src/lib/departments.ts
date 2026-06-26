import { prisma } from "./db";
import { DEPARTMENTS } from "./company-positions";

export async function ensureDepartmentsSeeded() {
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { slug: dept.slug },
      create: { name: dept.name, slug: dept.slug, code: dept.code, description: dept.description },
      update: { name: dept.name, code: dept.code, description: dept.description },
    });
  }
}

export async function listDepartments() {
  await ensureDepartmentsSeeded();
  return prisma.department.findMany({
    include: {
      hod: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });
}
