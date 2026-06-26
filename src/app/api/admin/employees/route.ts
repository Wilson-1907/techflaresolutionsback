import { NextRequest, NextResponse } from "next/server";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getDepartmentSlugById, getPositionsForDepartment, isValidPositionForDepartment, resolveEmployeeRole, STAFF_TIERS } from "@/lib/company-positions";
import type { StaffTier } from "@/lib/company-positions";
import { listDepartments } from "@/lib/departments";
import { allocateWorkId, peekNextWorkId } from "@/lib/work-id";
import { z } from "zod";

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  position: z.string().min(1),
  departmentId: z.string().min(1),
  isHod: z.boolean().optional(),
  staffTier: z.enum(["staff", "hod", "executive"]).optional(),
  role: z.enum(["EMPLOYEE", "HOD", "CIO", "ADMIN"]).optional(),
});

export async function GET(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const departmentId = req.nextUrl.searchParams.get("departmentId");
  const staffTier = req.nextUrl.searchParams.get("staffTier") as StaffTier | null;
  const nextWorkId = req.nextUrl.searchParams.get("nextWorkId");

  if (departmentId && staffTier && !nextWorkId) {
    const departments = await listDepartments();
    const slug = getDepartmentSlugById(departments, departmentId);
    return NextResponse.json({
      positions: getPositionsForDepartment(slug, staffTier),
      staffTiers: STAFF_TIERS,
    });
  }

  if (nextWorkId === "true" && departmentId) {
    const workId = await peekNextWorkId(prisma, departmentId);
    return NextResponse.json({ nextWorkId: workId, format: "DEPT_CODE + YY + NNN (e.g. SW26001)" });
  }

  const [employees, departments] = await Promise.all([
    prisma.employeeProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
          },
        },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    listDepartments(),
    Promise.resolve({ staffTiers: STAFF_TIERS }),
  ]);

  return NextResponse.json({ employees, departments, staffTiers: STAFF_TIERS });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  try {
    const body = createSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const departments = await listDepartments();
    const deptSlug = getDepartmentSlugById(departments, body.departmentId);
    const tier: StaffTier =
      body.staffTier ?? (body.isHod ? "hod" : body.position.toLowerCase().includes("chief") ? "executive" : "staff");

    if (!isValidPositionForDepartment(deptSlug, tier, body.position)) {
      return NextResponse.json(
        { error: "Position does not match the selected department and staff level." },
        { status: 400 }
      );
    }

    const workId = await allocateWorkId(prisma, body.departmentId);
    const isHod = tier === "hod";
    const role = body.role || resolveEmployeeRole(tier, body.position);

    const user = await prisma.user.create({
      data: {
        email,
        firstName: body.firstName,
        lastName: body.lastName,
        passwordHash: await hashPassword(body.password),
        role,
        emailVerified: true,
      },
    });

    const profile = await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        workId,
        position: body.position,
        departmentId: body.departmentId,
        isHod,
      },
      include: { department: { select: { name: true, code: true } } },
    });

    if (isHod) {
      await prisma.department.update({
        where: { id: body.departmentId },
        data: { hodId: user.id },
      });
    }

    await prisma.internalNotification.create({
      data: {
        title: "Welcome to TechFlare",
        message: `Your employee account is ready. Work ID: ${workId}. Sign in at the main site with your Work ID and password.`,
        recipientId: user.id,
      },
    });

    return NextResponse.json({ user: { id: user.id, email, workId }, profile }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not create employee" }, { status: 500 });
  }
}
