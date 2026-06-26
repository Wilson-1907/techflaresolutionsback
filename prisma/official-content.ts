import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const OFFICIAL_NEWS = [
  {
    title: "TechFlare Solutions Official Launch — 1 July 2026",
    slug: "official-launch-1-july-2026",
    category: "press_release",
    excerpt:
      "TechFlare Solutions will officially open and launch on 1 July 2026 — delivering enterprise software, innovation services, and digital transformation across Africa and beyond.",
    content: `Nairobi, Kenya — TechFlare Solutions today confirms its official public launch on 1 July 2026.

Following a structured pre-launch phase, the company is finalizing its platform, client portals, Innovation Hub, and enterprise delivery operations ahead of opening day. From 1 July 2026, clients, innovators, and partners will access the full TechFlare ecosystem: custom software development, product engineering, managed solutions, and end-to-end innovation support.

"Our mission is clear: Flaring Up the Future with Lines of Code," said the TechFlare leadership team. "We are building a technology company that operates at international standards — with the discipline of enterprise engineering and the ambition to lead in our industry."

What to expect at launch:
• Full client and innovator registration and portal access
• Innovation Hub submissions and feasibility analysis
• Enterprise software, web, mobile, and AI solutions
• Transparent project tracking, billing, and support

Until launch, this newsroom will publish pre-launch updates. For partnership inquiries, contact hello@techflaresolutions.com.`,
    authorName: "TechFlare Solutions Corporate Communications",
    published: true,
    publishedAt: new Date("2026-06-01T09:00:00.000Z"),
  },
  {
    title: "Pre-Launch Update: Enterprise Platform Nears Completion",
    slug: "pre-launch-platform-nears-completion",
    category: "announcement",
    excerpt:
      "TechFlare Solutions confirms its unified client portal, innovator pipeline, and admin operations are entering final validation ahead of the 1 July 2026 launch.",
    content: `TechFlare Solutions is in the final stages of pre-launch validation across its core platform — client onboarding, project delivery workflows, Innovation Hub intake, and secure admin operations.

The company has invested in a production-grade architecture designed for scale: verified user registration, role-based portals, structured project milestones, integrated billing, and a dedicated newsroom and insights channel for transparent communication.

This pre-launch period reflects our commitment to launching with operational maturity — not as a prototype, but as a company ready to compete and win in the software and innovation industry.`,
    authorName: "TechFlare Solutions Operations",
    published: true,
    publishedAt: new Date("2026-05-15T09:00:00.000Z"),
  },
  {
    title: "Innovation Hub Now Accepting Submissions Ahead of Launch",
    slug: "innovation-hub-accepting-submissions",
    category: "announcement",
    excerpt:
      "Innovators, researchers, and founders can submit ideas to the TechFlare Innovation Hub as the company prepares for its official 1 July 2026 opening.",
    content: `The TechFlare Innovation Hub is accepting idea submissions ahead of the company's official launch on 1 July 2026.

Whether you are building in agriculture, fintech, health, education, or emerging technology, TechFlare provides structured pathways from concept through feasibility analysis, prototyping, and commercial delivery.

Submit your idea through the Innovation Hub on our website. Registered innovators will receive portal access at launch to track progress, upload materials, and collaborate with our team.

TechFlare Solutions is building the infrastructure for serious innovation — with the governance, engineering depth, and commercial focus required to bring ideas to market.`,
    authorName: "Innovation Hub · TechFlare Solutions",
    published: true,
    publishedAt: new Date("2026-05-01T09:00:00.000Z"),
  },
] as const;

export const OFFICIAL_BLOGS = [
  {
    title: "Our Vision: Flaring Up the Future with Lines of Code",
    slug: "our-vision-flaring-up-the-future",
    excerpt:
      "TechFlare Solutions exists to build world-class software and turn bold ideas into scalable products. Here is the standard we hold ourselves to ahead of our July 2026 launch.",
    content: `Technology is not neutral — it shapes economies, communities, and opportunity. At TechFlare Solutions, we believe Africa and the global market deserve technology partners who combine engineering excellence with commercial discipline.

Our vision is straightforward: build software and innovation services that meet enterprise standards, ship reliably, and create measurable value for clients and innovators.

We are not interested in vanity projects or disconnected demos. We are building a company designed to dominate our industry through:
• Rigorous engineering practices and clear delivery methodology
• Transparent client communication and accountable project management
• An Innovation Hub that treats ideas as assets — researched, validated, and built with intent
• A long-term commitment to quality, security, and professional operations

On 1 July 2026, TechFlare Solutions officially opens its doors. Until then, we are preparing every system, process, and team capability to operate at the level our clients and partners expect from a serious technology company.

This is not a soft launch. This is the foundation of a company built to lead.`,
    tags: "company,vision,leadership",
    publishedAt: new Date("2026-05-20T09:00:00.000Z"),
  },
  {
    title: "Why Africa Will Lead the Next Wave of Software Innovation",
    slug: "africa-next-wave-software-innovation",
    excerpt:
      "From mobile-first markets to deep domain expertise in agriculture, finance, and logistics, Africa is positioned to define the next generation of software — and TechFlare is built for that future.",
    content: `The next decade of software innovation will not be defined solely in traditional tech hubs. It will be defined by markets that solve real problems at scale — often with fewer legacy constraints and greater urgency for impact.

Africa represents one of the most dynamic technology frontiers in the world. Mobile penetration, entrepreneurial energy, and domain-specific challenges create an environment where great software is not optional — it is essential infrastructure.

TechFlare Solutions is headquartered in this reality. We design for:
• Mobile-first and connectivity-aware architectures
• Solutions grounded in local context with global quality standards
• Partnerships with innovators who understand their industries deeply
• Delivery models that respect budget discipline and operational clarity

Our July 2026 launch aligns with this conviction: the companies that invest in serious engineering today will define the industry tomorrow. TechFlare intends to be among them.`,
    tags: "industry,africa,innovation",
    publishedAt: new Date("2026-05-10T09:00:00.000Z"),
  },
  {
    title: "The TechFlare Standard: Engineering Discipline Meets Bold Ideas",
    slug: "techflare-standard-engineering-discipline",
    excerpt:
      "World-class products require more than code — they require process, architecture, security, and accountability. This is the standard every TechFlare engagement is built on.",
    content: `Clients do not hire a technology company for activity. They hire for outcomes: systems that work, products that scale, and teams that communicate clearly when complexity arrives.

The TechFlare Standard is our operating contract with every client and innovator:

1. Discovery before development — we define scope, risks, and success criteria early.
2. Architecture with intent — we choose tools and patterns for maintainability, not hype.
3. Delivery in milestones — progress is visible, testable, and documented.
4. Security by default — authentication, data handling, and deployment hygiene are non-negotiable.
5. Professional communication — no ghosting, no ambiguity, no surprises on delivery dates.

Whether you are a enterprise client commissioning a platform or an innovator entering our hub, you should expect the same seriousness: structured process, skilled execution, and respect for your time and investment.

That is how companies ready to dominate an industry operate. That is how TechFlare Solutions is built.`,
    tags: "engineering,quality,enterprise",
    publishedAt: new Date("2026-04-28T09:00:00.000Z"),
  },
  {
    title: "Inside the Innovation Hub: From Concept to Commercial Product",
    slug: "inside-innovation-hub-concept-to-product",
    excerpt:
      "The TechFlare Innovation Hub is not a suggestion box. It is a structured pipeline for researching, validating, and building ideas with commercial potential.",
    content: `Many organizations collect ideas. Few build the infrastructure to evaluate them honestly and develop the ones worth pursuing.

The TechFlare Innovation Hub is designed as a professional innovation pipeline:

• Intake — structured submissions with clear problem statements and target users
• Feasibility — technical, market, and operational analysis before major investment
• Prototyping — focused builds that prove core assumptions quickly
• Partnership pathways — routes to co-development, licensing, or full product delivery

We serve innovators, researchers, and founders who want more than feedback — they want a partner with engineering capacity and commercial seriousness.

Ahead of our 1 July 2026 launch, the hub is open for submissions. At launch, registered innovators gain portal access to track status, share materials, and collaborate with our team.

If you are building something that matters, we built TechFlare to help you take it further — with the standards the industry demands.`,
    tags: "innovation,hub,products",
    publishedAt: new Date("2026-04-15T09:00:00.000Z"),
  },
] as const;

export async function seedOfficialContent(prisma: PrismaClient) {
  for (const item of OFFICIAL_NEWS) {
    await prisma.newsArticle.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        category: item.category,
        excerpt: item.excerpt,
        content: item.content,
        authorName: item.authorName,
        published: item.published,
        publishedAt: item.publishedAt,
      },
      create: item,
    });
  }

  let admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    admin = await prisma.user.upsert({
      where: { email: "admin@techflaresolutions.com" },
      update: { emailVerified: true },
      create: {
        email: "admin@techflaresolutions.com",
        passwordHash: await bcrypt.hash("admin123", 12),
        firstName: "TechFlare",
        lastName: "Editorial",
        role: "ADMIN",
        company: "TechFlare Solutions",
        emailVerified: true,
      },
    });
  }

  for (const item of OFFICIAL_BLOGS) {
    await prisma.blogPost.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        excerpt: item.excerpt,
        content: item.content,
        tags: item.tags,
        status: "APPROVED",
        authorRole: "ADMIN",
        publishedAt: item.publishedAt,
      },
      create: {
        title: item.title,
        slug: item.slug,
        excerpt: item.excerpt,
        content: item.content,
        tags: item.tags,
        status: "APPROVED",
        authorId: admin.id,
        authorRole: "ADMIN",
        publishedAt: item.publishedAt,
      },
    });
  }
}
