import type { PrismaClient } from "@prisma/client";

export const DEFAULT_JOBS = [
  {
    title: "Senior Full-Stack Engineer",
    department: "Engineering",
    location: "Remote",
    type: "full_time",
    description:
      "Lead end-to-end delivery of client platforms and internal products. You will architect APIs, ship production Next.js applications, and mentor engineers across the TechFlare delivery pipeline.",
    requirements:
      "5+ years full-stack experience · TypeScript, React, Node/Next.js · PostgreSQL · Strong communication and ownership · Experience with cloud deployment (Vercel, Render, or AWS)",
    active: true,
  },
  {
    title: "AI/ML Research Scientist",
    department: "R&D",
    location: "Nyeri, Kenya",
    type: "full_time",
    description:
      "Research and prototype AI systems for education, agriculture, and enterprise clients. Partner with the Innovation Hub to validate feasibility and move models into production.",
    requirements:
      "MS/PhD or equivalent experience in ML · Python, PyTorch or TensorFlow · LLM integration experience · Published work or shipped AI products preferred",
    active: true,
  },
  {
    title: "Software Engineering Intern",
    department: "Engineering",
    location: "Remote",
    type: "internship",
    description:
      "Join TechFlare's engineering team for a structured internship building real features on client and internal projects under senior mentorship.",
    requirements:
      "Computer science or related studies · JavaScript/TypeScript fundamentals · Git workflow · Portfolio or coursework projects · Available for 3–6 month internship",
    active: true,
  },
  {
    title: "Innovation Analyst",
    department: "Innovation",
    location: "Karatina, Kenya",
    type: "graduate",
    description:
      "Evaluate Innovation Hub submissions, conduct market and technical scans, and prepare feasibility briefs for leadership and engineering teams.",
    requirements:
      "Strong analytical writing · Interest in startups and product development · Business, engineering, or science background · Comfortable presenting findings to stakeholders",
    active: true,
  },
  {
    title: "IoT Engineer",
    department: "Internet of Things (IoT)",
    location: "Remote",
    type: "full_time",
    description:
      "Design, build, and deploy connected devices and sensor networks for agriculture, smart buildings, and enterprise clients. Work across embedded firmware, cloud ingestion, and dashboards.",
    requirements:
      "C/C++ or Python · Microcontrollers (ESP32, Arduino, Raspberry Pi) · MQTT/HTTP protocols · Cloud IoT platforms · Portfolio of hardware or IoT projects",
    active: true,
  },
] as const;

type ProductSeed = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: string;
  imageUrl?: string;
  externalUrl?: string;
  features: string[];
  howItWorks?: string[];
  sortOrder: number;
  published: boolean;
  source: string;
};

export const DEFAULT_PRODUCTS: ProductSeed[] = [
  {
    slug: "career-compass-cbe",
    title: "Career Compass",
    tagline: "AI-Powered CBE Career Guide for Kenyan Students",
    description:
      "Career Compass helps students navigate Kenya's Competency-Based Education system with confidence. Built by TechFlare Solutions, it uses AI to analyze interests, skills, and aspirations — delivering personalized career pathway recommendations, expert counseling connections, and interactive scenario learning.",
    status: "live",
    imageUrl: "/products/career-compass.svg",
    externalUrl: "https://aipoweredcbeguide.vercel.app/",
    features: [
      "AI career assessment (4-pillar analysis)",
      "Kenya CBE pathway recommendations",
      "AI counselor chat",
      "STEM, Social Sciences & Arts pathways",
      "Expert-verified guidance",
      "Free to start — no credit card required",
    ],
    howItWorks: [
      "Create a free account in under a minute",
      "Take the AI-powered 4-pillar career assessment",
      "Receive personalized pathway recommendations for Kenya's CBE curriculum",
      "Chat with the AI counselor or connect with verified experts",
      "Access resources, scenarios, and career guides to start your journey",
    ],
    sortOrder: 1,
    published: true,
    source: "techflare",
  },
  {
    slug: "biometric-voting-system",
    title: "Biometric Voting System",
    tagline: "Secure, transparent elections built for Kenya",
    description:
      "TechFlare Solutions is actively developing a next-generation biometric voting platform designed for institutional and national-scale elections. Voters authenticate via secure biometric identity, cast encrypted votes, and results are tallied with full audit trails — built with IEBC-grade security standards in mind.",
    status: "in-development",
    imageUrl: "/products/biometric-voting-system.png",
    features: [
      "Biometric voter authentication",
      "Tamper-proof vote recording",
      "Real-time results dashboard",
      "Full audit trail & verification",
      "Multi-language support",
      "Offline-capable kiosk mode",
    ],
    howItWorks: [
      "Voter verifies identity via biometric scan at the kiosk",
      "Secure ballot interface displays verified candidates",
      "Vote is encrypted and recorded with a confirmation receipt",
      "Results aggregate in real time with full audit logging",
      "Independent verification and transparent result publishing",
    ],
    sortOrder: 2,
    published: true,
    source: "techflare",
  },
  {
    slug: "biometric-class-attendance",
    title: "Biometric Class Attendance",
    tagline: "Contactless attendance for schools and institutions",
    description:
      "A biometric class attendance system is coming from TechFlare Solutions — designed for schools, colleges, and training institutions across Kenya. Fast check-in via fingerprint or facial recognition, real-time reporting for administrators, and seamless integration with existing school management systems.",
    status: "coming-soon",
    features: [
      "Fingerprint & facial recognition",
      "Real-time attendance dashboards",
      "Parent & admin notifications",
      "Multi-campus support",
      "Offline mode for low-connectivity areas",
      "API integrations with school systems",
    ],
    sortOrder: 3,
    published: true,
    source: "techflare",
  },
];

export async function seedCatalogContent(prisma: PrismaClient) {
  for (const job of DEFAULT_JOBS) {
    const existing = await prisma.jobPosting.findFirst({ where: { title: job.title } });
    if (existing) {
      await prisma.jobPosting.update({
        where: { id: existing.id },
        data: job,
      });
    } else {
      await prisma.jobPosting.create({ data: job });
    }
  }

  for (const product of DEFAULT_PRODUCTS) {
    const { features, howItWorks, ...rest } = product;
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        ...rest,
        features,
        howItWorks: howItWorks ?? undefined,
      },
      create: {
        ...rest,
        features,
        howItWorks: howItWorks ?? undefined,
      },
    });
  }
}
