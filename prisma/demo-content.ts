import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEPARTMENTS } from "../src/lib/company-positions";

const DEMO_PASSWORD = "TechFlare@Demo2026";

async function hashPassword() {
  return bcrypt.hash(DEMO_PASSWORD, 12);
}

async function upsertUser(
  prisma: PrismaClient,
  data: {
    email: string;
    firstName: string;
    lastName: string;
    role: "CLIENT" | "INNOVATOR" | "EMPLOYEE" | "HOD" | "CIO" | "ADMIN";
    company?: string;
    phone?: string;
    points?: number;
  },
  passwordHash: string
) {
  return prisma.user.upsert({
    where: { email: data.email.toLowerCase() },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      company: data.company,
      phone: data.phone,
      points: data.points,
      emailVerified: true,
    },
    create: {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      company: data.company,
      phone: data.phone,
      points: data.points ?? 0,
      emailVerified: true,
      authProvider: "email",
    },
  });
}

export async function seedDemoContent(prisma: PrismaClient) {
  const passwordHash = await hashPassword();

  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { slug: dept.slug },
      update: { name: dept.name, code: dept.code, description: dept.description },
      create: { name: dept.name, slug: dept.slug, code: dept.code, description: dept.description },
    });
  }

  const swDept = await prisma.department.findUniqueOrThrow({ where: { slug: "software-engineering" } });
  const fnDept = await prisma.department.findUniqueOrThrow({ where: { slug: "finance" } });
  const riDept = await prisma.department.findUniqueOrThrow({ where: { slug: "research-innovation" } });

  const sarah = await upsertUser(prisma, {
    email: "sarah.client@techflare.demo",
    firstName: "Sarah",
    lastName: "Mwangi",
    role: "CLIENT",
    company: "Nairobi Logistics Ltd",
    phone: "+254712345001",
    points: 420,
  }, passwordHash);

  const james = await upsertUser(prisma, {
    email: "james.client@techflare.demo",
    firstName: "James",
    lastName: "Ochieng",
    role: "CLIENT",
    company: "GreenFarm Co-operative",
    points: 180,
  }, passwordHash);

  const jane = await upsertUser(prisma, {
    email: "jane.innovator@techflare.demo",
    firstName: "Jane",
    lastName: "Akinyi",
    role: "INNOVATOR",
    points: 650,
  }, passwordHash);

  const peter = await upsertUser(prisma, {
    email: "peter.innovator@techflare.demo",
    firstName: "Peter",
    lastName: "Kamau",
    role: "INNOVATOR",
    points: 320,
  }, passwordHash);

  const wilson = await prisma.user.findUnique({ where: { email: "wkabucho4@gmail.com" } });
  const wilsonClient =
    wilson ??
    (await upsertUser(prisma, {
      email: "wkabucho4@gmail.com",
      firstName: "Wilson",
      lastName: "Kinyanjui",
      role: "CLIENT",
      company: "TechFlare Solutions",
      points: 500,
    }, passwordHash));

  if (wilson) {
    await prisma.user.update({
      where: { id: wilson.id },
      data: { emailVerified: true, company: wilson.company || "TechFlare Solutions" },
    });
  }

  const cio = await upsertUser(prisma, {
    email: "cio@techflare.demo",
    firstName: "David",
    lastName: "Mwangi",
    role: "CIO",
  }, passwordHash);

  const mary = await upsertUser(prisma, {
    email: "mary.hod@techflare.demo",
    firstName: "Mary",
    lastName: "Wanjiku",
    role: "HOD",
  }, passwordHash);

  const samuel = await upsertUser(prisma, {
    email: "samuel.dev@techflare.demo",
    firstName: "Samuel",
    lastName: "Otieno",
    role: "EMPLOYEE",
  }, passwordHash);

  const grace = await upsertUser(prisma, {
    email: "grace.dev@techflare.demo",
    firstName: "Grace",
    lastName: "Njeri",
    role: "EMPLOYEE",
  }, passwordHash);

  const ruth = await upsertUser(prisma, {
    email: "ruth.finance@techflare.demo",
    firstName: "Ruth",
    lastName: "Achieng",
    role: "EMPLOYEE",
  }, passwordHash);

  async function upsertEmployee(
    userId: string,
    workId: string,
    position: string,
    departmentId: string,
    isHod: boolean
  ) {
    await prisma.employeeProfile.upsert({
      where: { userId },
      update: { workId, position, departmentId, isHod, active: true },
      create: { userId, workId, position, departmentId, isHod, active: true },
    });
  }

  await upsertEmployee(cio.id, "CI26001", "Chief Information Officer (CIO)", swDept.id, false);
  await upsertEmployee(mary.id, "SW26001", "Head of Department (HOD)", swDept.id, true);
  await upsertEmployee(samuel.id, "SW26002", "Senior Software Engineer", swDept.id, false);
  await upsertEmployee(grace.id, "SW26003", "Software Engineer", swDept.id, false);
  await upsertEmployee(ruth.id, "FN26001", "Finance Officer", fnDept.id, false);

  await prisma.department.update({
    where: { id: swDept.id },
    data: { hodId: mary.id },
  });

  // —— Solutions ——
  const solutionFleet = await prisma.solutionRequest.findFirst({
    where: { userId: sarah.id, problem: { contains: "fleet management" } },
  }).then(
    (r) =>
      r ??
      prisma.solutionRequest.create({
        data: {
          problem:
            "We need a fleet management dashboard to track 120 delivery vehicles in real time, with route optimization and driver performance reports.",
          budget: "2m-10m",
          industry: "logistics",
          timeline: "3-6-months",
          status: "PROPOSAL_SENT",
          userId: sarah.id,
          guestName: "Sarah Mwangi",
          guestEmail: sarah.email,
        },
      })
  );

  const solutionFarm = await prisma.solutionRequest.findFirst({ where: { userId: james.id } }).then(
    (r) =>
      r ??
      prisma.solutionRequest.create({
        data: {
          problem:
            "Smallholder farmers need a mobile app to record harvests, access market prices, and connect with buyers across western Kenya.",
          budget: "500k-2m",
          industry: "agriculture",
          timeline: "1-3-months",
          status: "ANALYZING",
          userId: james.id,
          guestName: "James Ochieng",
          guestEmail: james.email,
        },
      })
  );

  const solutionWilson = await prisma.solutionRequest.findFirst({ where: { userId: wilsonClient.id } }).then(
    (r) =>
      r ??
      prisma.solutionRequest.create({
        data: {
          problem:
            "Build a client portal and payment integration for our SaaS product with M-Pesa and automated invoicing.",
          budget: "2m-10m",
          industry: "fintech",
          timeline: "3-6-months",
          status: "ACCEPTED",
          userId: wilsonClient.id,
          guestName: `${wilsonClient.firstName} ${wilsonClient.lastName}`,
          guestEmail: wilsonClient.email,
        },
      })
  );

  // —— Ideas ——
  const ideaCrop = await prisma.idea.findFirst({ where: { title: "AI Crop Disease Detector", userId: jane.id } }).then(
    (r) =>
      r ??
      prisma.idea.create({
        data: {
          title: "AI Crop Disease Detector",
          description:
            "Smartphone-based computer vision to detect maize and wheat diseases early, with SMS alerts for extension officers.",
          category: "agriculture",
          type: "invention",
          status: "FEASIBILITY_ANALYSIS",
          userId: jane.id,
        },
      })
  );

  const ideaFintech = await prisma.idea.findFirst({ where: { title: "M-Shamba Savings Groups", userId: peter.id } }).then(
    (r) =>
      r ??
      prisma.idea.create({
        data: {
          title: "M-Shamba Savings Groups",
          description:
            "Digital chama platform for rural savings groups with transparent ledgers and M-Pesa integration.",
          category: "fintech",
          type: "business_concept",
          status: "APPROVED",
          userId: peter.id,
        },
      })
  );

  const ideaWilson = await prisma.idea.findFirst({ where: { userId: wilsonClient.id } }).then(
    (r) =>
      r ??
      prisma.idea.create({
        data: {
          title: "Smart Irrigation Controller",
          description: "IoT soil-moisture sensors with automated drip irrigation for greenhouse farms.",
          category: "agriculture",
          type: "idea",
          status: "IN_DEVELOPMENT",
          userId: wilsonClient.id,
        },
      })
  );

  // —— Projects ——
  async function ensureProject(
    clientId: string,
    name: string,
    data: {
      description: string;
      status: "PLANNING" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "ON_HOLD";
      progress: number;
    }
  ) {
    const existing = await prisma.project.findFirst({ where: { name, clientId } });
    if (existing) {
      await prisma.project.update({
        where: { id: existing.id },
        data: { status: data.status, progress: data.progress, description: data.description },
      });
      return existing;
    }
    return prisma.project.create({
      data: {
        name,
        description: data.description,
        status: data.status,
        progress: data.progress,
        clientId,
        milestones: {
          create: [
            { title: "Discovery & requirements", completed: true, dueDate: new Date("2026-02-01") },
            { title: "Design & architecture", completed: true, dueDate: new Date("2026-03-15") },
            { title: "Development sprint 1", completed: data.progress > 40, dueDate: new Date("2026-05-01") },
            { title: "Testing & UAT", completed: data.progress >= 90, dueDate: new Date("2026-07-01") },
            { title: "Go-live & handover", completed: data.status === "COMPLETED", dueDate: new Date("2026-08-01") },
          ],
        },
        invoices: {
          create: [
            {
              number: `INV-DEMO-${name.slice(0, 3).toUpperCase()}-01`,
              amount: 850000,
              status: data.progress > 30 ? "paid" : "pending",
              dueDate: new Date("2026-04-01"),
            },
            {
              number: `INV-DEMO-${name.slice(0, 3).toUpperCase()}-02`,
              amount: 550000,
              status: "pending",
              dueDate: new Date("2026-08-01"),
            },
          ],
        },
      },
    });
  }

  const projectSarah = await ensureProject(sarah.id, "Fleet Management Platform", {
    description: "Real-time fleet tracking and analytics for Nairobi Logistics Ltd.",
    status: "IN_PROGRESS",
    progress: 58,
  });

  const projectJames = await ensureProject(james.id, "GreenFarm Market App", {
    description: "Mobile marketplace connecting farmers to buyers.",
    status: "PLANNING",
    progress: 15,
  });

  const projectWilson = await ensureProject(wilsonClient.id, "Client Portal & Payments", {
    description: "SaaS client portal with M-Pesa billing and automated invoices.",
    status: "IN_PROGRESS",
    progress: 72,
  });

  // —— Finance documents ——
  const financeInvoiceSent = await prisma.financeDocument.upsert({
    where: { number: "TFS/26/06/201" },
    update: {},
    create: {
      docType: "invoice",
      number: "TFS/26/06/201",
      status: "sent",
      currency: "KES",
      subtotal: 2400000,
      total: 2400000,
      lineItems: [
        { description: "Fleet dashboard — Phase 1 (design + core API)", qty: 1, unitPrice: 1200000, amount: 1200000 },
        { description: "Mobile driver app — MVP", qty: 1, unitPrice: 1200000, amount: 1200000 },
      ],
      splits: { depositPercent: 60, balancePercent: 40, depositAmount: 1440000, balanceAmount: 960000 },
      clientName: "Sarah Mwangi",
      clientEmail: sarah.email,
      clientRole: "CLIENT",
      dueDate: new Date("2026-07-15"),
      notes: "60% deposit due before work starts. Balance on delivery per Terms & Conditions.",
    },
  });

  const financeInvoicePaid = await prisma.financeDocument.upsert({
    where: { number: "TFS/26/05/108" },
    update: {},
    create: {
      docType: "invoice",
      number: "TFS/26/05/108",
      status: "paid",
      currency: "KES",
      subtotal: 1800000,
      total: 1800000,
      lineItems: [
        { description: "Portal development — Sprint 1 & 2", qty: 1, unitPrice: 1800000, amount: 1800000 },
      ],
      splits: { depositPercent: 60, balancePercent: 40, depositAmount: 1080000, balanceAmount: 720000 },
      clientName: `${wilsonClient.firstName} ${wilsonClient.lastName}`,
      clientEmail: wilsonClient.email,
      clientRole: "CLIENT",
      paidAt: new Date("2026-05-20"),
      paymentMethod: "M-Pesa",
    },
  });

  const financeReceipt = await prisma.financeDocument.upsert({
    where: { number: "TFS/RCP/26/05/108" },
    update: {},
    create: {
      docType: "receipt",
      number: "TFS/RCP/26/05/108",
      status: "paid",
      currency: "KES",
      subtotal: 1080000,
      total: 1080000,
      lineItems: [{ description: "Deposit — Client Portal & Payments", qty: 1, unitPrice: 1080000, amount: 1080000 }],
      clientName: `${wilsonClient.firstName} ${wilsonClient.lastName}`,
      clientEmail: wilsonClient.email,
      invoiceRef: "TFS/26/05/108",
      paymentMethod: "M-Pesa",
      paidAt: new Date("2026-05-20"),
    },
  });

  // —— Service workflows ——
  const financeStages = [
    { title: "Discovery & UX", description: "Workshops and wireframes", cost: 400000 },
    { title: "Core development", description: "API, dashboard, integrations", cost: 1400000 },
    { title: "Testing & deployment", description: "UAT, training, go-live", cost: 600000 },
  ];

  async function upsertWorkflow(data: {
    id: string;
    type: string;
    sourceId: string;
    title: string;
    summary: string;
    clientId?: string;
    departmentId?: string;
    status: import("@prisma/client").WorkflowStatus;
    financeTotal?: number;
    financeDocId?: string;
    clientAgreed?: boolean;
    depositPaid?: boolean;
    depositPercent?: number;
    progress?: number;
    workStarted?: boolean;
    hodBudget?: number;
  }) {
    return prisma.serviceWorkflow.upsert({
      where: { id: data.id },
      update: {
        status: data.status,
        financeTotal: data.financeTotal,
        financeDocId: data.financeDocId,
        clientAgreed: data.clientAgreed ?? false,
        depositPaid: data.depositPaid ?? false,
        progress: data.progress ?? 0,
        workStarted: data.workStarted ?? false,
        financeStages,
      },
      create: {
        id: data.id,
        type: data.type,
        sourceId: data.sourceId,
        title: data.title,
        summary: data.summary,
        clientId: data.clientId,
        departmentId: data.departmentId,
        status: data.status,
        financeTotal: data.financeTotal,
        financeDocId: data.financeDocId,
        financeStages,
        hodBudget: data.hodBudget,
        clientAgreed: data.clientAgreed ?? false,
        depositPaid: data.depositPaid ?? false,
        depositPercent: data.depositPercent ?? 60,
        progress: data.progress ?? 0,
        workStarted: data.workStarted ?? false,
      },
    });
  }

  await upsertWorkflow({
    id: "demo-wf-fleet-sent",
    type: "solution",
    sourceId: solutionFleet.id,
    title: "Fleet Management Platform",
    summary: solutionFleet.problem,
    clientId: sarah.id,
    departmentId: swDept.id,
    status: "SENT_TO_CLIENT",
    financeTotal: 2400000,
    financeDocId: financeInvoiceSent.id,
    hodBudget: 2100000,
  });

  await upsertWorkflow({
    id: "demo-wf-farm-hod",
    type: "solution",
    sourceId: solutionFarm.id,
    title: "GreenFarm Market App",
    summary: solutionFarm.problem,
    clientId: james.id,
    departmentId: swDept.id,
    status: "HOD_BUDGET_SUBMITTED",
    hodBudget: 950000,
  });

  await upsertWorkflow({
    id: "demo-wf-wilson-progress",
    type: "solution",
    sourceId: solutionWilson.id,
    title: "Client Portal & Payments",
    summary: solutionWilson.problem,
    clientId: wilsonClient.id,
    departmentId: swDept.id,
    status: "IN_PROGRESS",
    financeTotal: 1800000,
    financeDocId: financeInvoicePaid.id,
    clientAgreed: true,
    depositPaid: true,
    workStarted: true,
    progress: 72,
  });

  await upsertWorkflow({
    id: "demo-wf-crop-admin",
    type: "idea",
    sourceId: ideaCrop.id,
    title: ideaCrop.title,
    summary: ideaCrop.description,
    clientId: jane.id,
    departmentId: riDept.id,
    status: "ASSIGNED_TO_DEPT",
    hodBudget: 750000,
  });

  await upsertWorkflow({
    id: "demo-wf-fintech-finance",
    type: "idea",
    sourceId: ideaFintech.id,
    title: ideaFintech.title,
    summary: ideaFintech.description,
    clientId: peter.id,
    departmentId: riDept.id,
    status: "FINANCE_REVIEW",
    hodBudget: 1200000,
  });

  await upsertWorkflow({
    id: "demo-wf-wilson-idea",
    type: "idea",
    sourceId: ideaWilson.id,
    title: ideaWilson.title,
    summary: ideaWilson.description,
    clientId: wilsonClient.id,
    departmentId: riDept.id,
    status: "WORK_STARTED",
    financeTotal: 680000,
    clientAgreed: true,
    depositPaid: true,
    workStarted: true,
    progress: 45,
  });

  // —— Notifications ——
  const existingNotif = await prisma.notification.count({ where: { userId: sarah.id } });
  if (existingNotif === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: sarah.id,
          title: "Proposal ready for review",
          message: "Your Fleet Management Platform proposal and invoice are ready. Please review and agree in your portal.",
          read: false,
        },
        {
          userId: wilsonClient.id,
          title: "Sprint 3 milestone reached",
          message: "Client Portal & Payments is 72% complete. Next: payment gateway testing.",
          read: false,
        },
        {
          userId: jane.id,
          title: "Idea under feasibility review",
          message: "AI Crop Disease Detector has moved to feasibility analysis.",
          read: true,
        },
      ],
    });
  }

  const existingTickets = await prisma.supportTicket.count({ where: { userId: sarah.id } });
  if (existingTickets === 0) {
    await prisma.supportTicket.createMany({
      data: [
        {
          userId: sarah.id,
          subject: "Invoice clarification — fleet project",
          message: "Please confirm the deployment timeline for Phase 1.",
          status: "open",
          priority: "medium",
        },
        {
          userId: wilsonClient.id,
          subject: "Portal login on mobile",
          message: "Dashboard layout on small screens needs adjustment.",
          status: "in_progress",
          priority: "low",
        },
      ],
    });
  }

  const existingOrders = await prisma.productOrder.count({ where: { userId: jane.id } });
  if (existingOrders === 0) {
    await prisma.productOrder.createMany({
      data: [
        {
          userId: jane.id,
          productSlug: "career-compass",
          productTitle: "Career Compass",
          plan: "Professional",
          customerName: "Jane Akinyi",
          customerEmail: jane.email,
          message: "Demo order for innovator portal preview.",
          amountKes: 4999,
          status: "completed",
          paymentStatus: "paid",
        },
        {
          userId: peter.id,
          productSlug: "innovation-toolkit",
          productTitle: "Innovation Toolkit",
          plan: "Starter",
          customerName: "Peter Kamau",
          customerEmail: peter.email,
          message: "Demo order — pending payment.",
          amountKes: 2999,
          status: "pending",
          paymentStatus: "unpaid",
        },
      ],
    });
  }

  console.log("Demo content seeded. Password for all @techflare.demo accounts:", DEMO_PASSWORD);
  console.log("Demo logins:", {
    clients: [sarah.email, james.email, wilsonClient.email],
    innovators: [jane.email, peter.email],
    staff: {
      cio: "CI26001",
      hod: "SW26001",
      developers: ["SW26002", "SW26003"],
      finance: "FN26001",
    },
    projects: [projectSarah.name, projectJames.name, projectWilson.name],
    financeDocs: [financeInvoiceSent.number, financeInvoicePaid.number, financeReceipt.number],
  });
}
