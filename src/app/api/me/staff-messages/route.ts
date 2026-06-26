import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

import { prisma } from "@/lib/db";

import { COMPANY_OFFICES } from "@/lib/company-offices";

import { z } from "zod";



const STAFF_ROLES = ["EMPLOYEE", "HOD", "CIO", "ADMIN"];



const LEADERSHIP_ROLES = ["HOD", "CIO", "ADMIN"];



export async function GET() {

  const session = await getSession();

  if (!session || !STAFF_ROLES.includes(session.role)) {

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  }



  const profile = await prisma.employeeProfile.findUnique({

    where: { userId: session.id },

    include: { department: true },

  });



  const messages = await prisma.staffMessage.findMany({

    where: {

      OR: [

        { recipientId: session.id },

        { senderId: session.id },

        ...(profile?.departmentId

          ? [{ departmentId: profile.departmentId, audience: "department" }]

          : []),

        ...(profile?.office ? [{ office: profile.office, audience: "office" }] : []),

        { audience: "company" },

      ],

    },

    include: {

      sender: { select: { id: true, firstName: true, lastName: true, role: true } },

      recipient: { select: { id: true, firstName: true, lastName: true, role: true } },

      department: { select: { id: true, name: true } },

    },

    orderBy: { createdAt: "desc" },

    take: 100,

  });



  const [departments, staff] = await Promise.all([

    prisma.department.findMany({

      select: { id: true, name: true, slug: true },

      orderBy: { name: "asc" },

    }),

    prisma.user.findMany({

      where: { role: { in: ["EMPLOYEE", "HOD", "CIO", "ADMIN"] } },

      select: {

        id: true,

        firstName: true,

        lastName: true,

        role: true,

        employeeProfile: {

          select: {

            position: true,

            office: true,

            department: { select: { name: true } },

          },

        },

      },

      orderBy: { firstName: "asc" },

      take: 200,

    }),

  ]);



  return NextResponse.json({

    messages,

    departments,

    staff,

    offices: COMPANY_OFFICES,

    profile,

  });

}



const postSchema = z.object({

  subject: z.string().min(1),

  body: z.string().min(1),

  recipientId: z.string().optional(),

  departmentId: z.string().optional(),

  office: z.string().optional(),

  audience: z.enum(["direct", "department", "office", "company"]).optional(),

  workflowId: z.string().optional(),

});



export async function POST(req: NextRequest) {

  const session = await getSession();

  if (!session || !STAFF_ROLES.includes(session.role)) {

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  }



  try {

    const body = postSchema.parse(await req.json());

    const profile = await prisma.employeeProfile.findUnique({

      where: { userId: session.id },

    });



    const audience =

      body.audience ??

      (body.office

        ? "office"

        : body.departmentId

          ? "department"

          : body.recipientId

            ? "direct"

            : "direct");



    if (audience === "company" && !LEADERSHIP_ROLES.includes(session.role)) {

      return NextResponse.json({ error: "Only HOD and leadership can broadcast company-wide" }, { status: 403 });

    }



    if (audience === "department" && !body.departmentId && !profile?.departmentId) {

      return NextResponse.json({ error: "Department required" }, { status: 400 });

    }



    if (audience === "office" && !body.office) {

      return NextResponse.json({ error: "Office required" }, { status: 400 });

    }



    if (audience === "direct" && !body.recipientId) {

      return NextResponse.json({ error: "Recipient required" }, { status: 400 });

    }



    const officeSlug = audience === "office" ? body.office : null;



    const msg = await prisma.staffMessage.create({

      data: {

        senderId: session.id,

        recipientId: audience === "direct" ? body.recipientId : null,

        departmentId:

          audience === "department" ? body.departmentId || profile?.departmentId : null,

        office: officeSlug,

        audience,

        subject: body.subject.trim(),

        body: body.body.trim(),

        workflowId: body.workflowId,

      },

    });



    if (body.recipientId && audience === "direct") {

      await prisma.internalNotification.create({

        data: {

          title: `Message: ${body.subject.trim()}`,

          message: body.body.trim().slice(0, 500),

          recipientId: body.recipientId,

          senderId: session.id,

        },

      });

    }



    if (audience === "department" && (body.departmentId || profile?.departmentId)) {

      await prisma.internalNotification.create({

        data: {

          title: `Department message: ${body.subject.trim()}`,

          message: body.body.trim().slice(0, 500),

          departmentId: body.departmentId || profile?.departmentId,

          senderId: session.id,

        },

      });

    }



    if (audience === "office" && officeSlug) {

      const officeStaff = await prisma.employeeProfile.findMany({

        where: { office: officeSlug, active: true },

        select: { userId: true },

      });

      for (const member of officeStaff) {

        if (member.userId === session.id) continue;

        await prisma.internalNotification.create({

          data: {

            title: `Office message: ${body.subject.trim()}`,

            message: body.body.trim().slice(0, 500),

            recipientId: member.userId,

            senderId: session.id,

          },

        });

      }

    }



    if (audience === "company") {

      const depts = await prisma.department.findMany({ select: { id: true } });

      for (const d of depts) {

        await prisma.internalNotification.create({

          data: {

            title: `Company: ${body.subject.trim()}`,

            message: body.body.trim().slice(0, 500),

            departmentId: d.id,

            senderId: session.id,

          },

        });

      }

    }



    return NextResponse.json({ message: msg });

  } catch (e) {

    if (e instanceof z.ZodError) {

      return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    }

    return NextResponse.json({ error: "Could not send message" }, { status: 500 });

  }

}

