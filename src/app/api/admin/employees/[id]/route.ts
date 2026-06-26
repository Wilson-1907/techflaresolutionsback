import { NextRequest, NextResponse } from "next/server";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { COMPANY_POSITIONS } from "@/lib/company-positions";
import { z } from "zod";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  position: z.string().min(1).optional(),
  departmentId: z.string().nullable().optional(),
  isHod: z.boolean().optional(),
  role: z.enum(["EMPLOYEE", "HOD", "CIO", "ADMIN"]).optional(),
  active: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const { id } = await params;
  const profile = await prisma.employeeProfile.findFirst({
    where: { OR: [{ id }, { userId: id }] },
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
  });

  if (!profile) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  return NextResponse.json({ employee: profile, positions: COMPANY_POSITIONS });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminApiKey(req)) return adminUnauthorized();

  const { id } = await params;

  try {
    const body = updateSchema.parse(await req.json());
    const profile = await prisma.employeeProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      include: { user: true },
    });

    if (!profile) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    let role = body.role ?? profile.user.role;
    if (body.isHod === true) role = "HOD";
    if (body.isHod === false && role === "HOD") role = "EMPLOYEE";
    if (body.position?.toLowerCase().includes("cio")) role = "CIO";

    if (body.email && body.email.toLowerCase() !== profile.user.email) {
      const taken = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (taken && taken.id !== profile.userId) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    const userUpdate: Record<string, unknown> = {};
    if (body.firstName) userUpdate.firstName = body.firstName;
    if (body.lastName) userUpdate.lastName = body.lastName;
    if (body.email) userUpdate.email = body.email.toLowerCase();
    if (body.password) userUpdate.passwordHash = await hashPassword(body.password);
    if (body.role || body.isHod !== undefined || body.position) userUpdate.role = role;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: profile.userId }, data: userUpdate });
    }

    const profileUpdate: Record<string, unknown> = {};
    if (body.position) profileUpdate.position = body.position;
    if (body.departmentId !== undefined) profileUpdate.departmentId = body.departmentId;
    if (body.isHod !== undefined) profileUpdate.isHod = body.isHod;
    if (body.active !== undefined) profileUpdate.active = body.active;

    const updated = await prisma.employeeProfile.update({
      where: { id: profile.id },
      data: profileUpdate,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
        },
        department: { select: { id: true, name: true, code: true } },
      },
    });

    if (body.isHod && body.departmentId) {
      await prisma.department.update({
        where: { id: body.departmentId },
        data: { hodId: profile.userId },
      });
    }

    if (body.active === false) {
      await prisma.internalNotification.create({
        data: {
          title: "Account deactivated",
          message: "Your TechFlare employee portal access has been deactivated. Contact HR if you believe this is an error.",
          recipientId: profile.userId,
        },
      });
    } else if (body.active === true && !profile.active) {
      await prisma.internalNotification.create({
        data: {
          title: "Account reactivated",
          message: `Your employee account (${profile.workId}) is active again. Sign in at the main site.`,
          recipientId: profile.userId,
        },
      });
    }

    if (body.position || body.role || body.isHod !== undefined) {
      await prisma.internalNotification.create({
        data: {
          title: "Profile updated",
          message: `Your role/position was updated by admin. Current position: ${updated.position}. Work ID ${updated.workId} stays the same.`,
          recipientId: profile.userId,
        },
      });
    }

    return NextResponse.json({ employee: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not update employee" }, { status: 500 });
  }
}
