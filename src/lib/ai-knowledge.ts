import {
  company,
  accountVsCommunity,
  services,
  industries,
  products,
  innovationWorkflow,
  navLinks,
} from "@/data/site";
import {
  buildPolicyDocument,
  paymentPolicy,
  reviewSla,
  workflowStages,
  termsSections,
} from "@/data/policies";
import {
  matchNavigationIntent,
  creativeFallback,
  type ChatAction,
  type ChatResolution,
} from "@/lib/ai-navigation";

export type { ChatAction, ChatResolution };

const POLICY_DOCUMENT = buildPolicyDocument();

export const AI_SYSTEM_PROMPT = `You are TechFlare Solutions AI assistant — helpful, warm, and professional.
Company: ${company.name} — "${company.tagline}".
Mission: ${company.mission}

Always answer using facts from TechFlare's website and the official policy document below.
Guide users to the right page when relevant.
Contact: ${company.email}, phone & WhatsApp ${company.phone}.
Social: @${company.social.handle} on Instagram, Facebook, TikTok, X, and LinkedIn.
Offices: ${company.offices.map((o) => o.city).join(" & ")}, ${company.country}.
Community WhatsApp: ${company.communityWhatsApp}

Key rules:
- Browsing is free; sign-in required for Solutions Center AI proposals, Innovation Hub submissions, AI tools, and portals.
- Product orders use /products — sign-in recommended for tracking.
- Account sign-up and WhatsApp community membership are separate.
- Careers require community membership.
- Clients earn points (${company.pointsRate * 100}% of profit value on qualifying projects).
- Sensitive user data is encrypted at rest in our database.
- NEVER say "I don't know", "I can't help", or refuse — always give a warm, creative, actionable answer and suggest contact or navigation.
- Portal submit paths: innovator ideas → /portal/innovation/submit; client projects → /portal/client/submit; pay invoices → /portal/client/invoices.

OFFICIAL POLICY DOCUMENT (use for terms, payments, workflow, portal questions):
${POLICY_DOCUMENT}`;

export const knowledgeTopics: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["service", "offer", "what do you do", "help with"],
    answer: `TechFlare Solutions offers: ${services.map((s) => s.title).join(", ")}. Visit /services for details. We take you from research and innovation through engineering to deployment.`,
  },
  {
    keywords: ["innovation hub", "innovation", "hub", "submit idea", "invention"],
    answer: `The Innovation Hub at /innovation-hub is our centerpiece. Signed-in innovators submit at /portal/innovation/submit. Pipeline: ${innovationWorkflow.map((w) => w.title).join(" → ")}. Track at /portal/innovation.`,
  },
  {
    keywords: ["idea", "submit", "proposal"],
    answer:
      "Innovators: submit at /portal/innovation/submit (account required). Clients with business problems: /portal/client/submit or /solutions for AI proposal help after sign-in.",
  },
  {
    keywords: ["industr", "sector", "ecommerce", "e-commerce", "technology", "fintech", "retail", "saas"],
    answer: `We serve ${industries.length} industries including technology, e-commerce & retail, software & SaaS, fintech, healthcare, education, government, manufacturing, and more. Full list at /industries.`,
  },
  {
    keywords: ["product", "voting", "biometric", "attendance", "career", "cbe", "order", "buy", "purchase"],
    answer: `TechFlare products: ${products.map((p) => `${p.title} (${p.status})`).join("; ")}. Career Compass is live at https://aipoweredcbeguide.vercel.app/. View all at /products.`,
  },
  {
    keywords: ["voting system", "biometric voting", "election", "iebc"],
    answer:
      "Our Biometric Voting System is currently in development at TechFlare Solutions — secure voter authentication, real-time results, and audit trails designed for Kenya. See /products/biometric-voting-system or contact us for pilot partnerships.",
  },
  {
    keywords: ["career compass", "cbe", "career guide", "student"],
    answer:
      "Career Compass is our live AI-powered CBE career guide for Kenyan students — built by TechFlare Solutions. Free to start at https://aipoweredcbeguide.vercel.app/. Features AI assessment, pathway recommendations, and expert counseling.",
  },
  {
    keywords: ["solution", "problem", "solve", "proposal", "ai proposal"],
    answer:
      "Visit /solutions to describe your problem. After signing in, use our AI proposal generator for a preliminary plan. Our team follows up within 48 hours.",
  },
  {
    keywords: ["contact", "email", "phone", "whatsapp", "call", "reach"],
    answer: `Contact TechFlare: ${company.email}, phone & WhatsApp ${company.phone}. Follow @${company.social.handle} on social media. Offices in ${company.offices.map((o) => o.city).join(" and ")}, Kenya. Online and physical — /contact.`,
  },
  {
    keywords: ["community", "whatsapp group", "join group"],
    answer: `${accountVsCommunity.communityDescription} Join via ${company.communityWhatsApp}. Share your email in the group for notifications. Confirm at /community (requires account).`,
  },
  {
    keywords: ["account", "register", "sign up", "signup", "login", "sign in", "portal", "employee", "work id", "staff"],
    answer: `${accountVsCommunity.accountDescription} Register at /register (clients & innovators). Login at /login — use Email tab for clients/innovators, or Employee tab with Work ID + password for staff. Client portal: /portal/client. Innovation: /portal/innovation. Employee portal: /portal/employee. Admin panel is separate for company admins.`,
  },
  {
    keywords: ["career", "job", "intern", "hire", "work with"],
    answer:
      "Careers are at /careers. You must be a member of our WhatsApp community to apply. Join the community first, then apply with your community membership confirmed.",
  },
  {
    keywords: ["point", "reward", "discount", "client benefit"],
    answer: company.pointsDescription,
  },
  {
    keywords: ["about", "mission", "vision", "who are you", "techflare"],
    answer: `${company.name}: ${company.tagline}. ${company.mission} Learn more at /about.`,
  },
  {
    keywords: ["research", "white paper", "case study", "report"],
    answer: "Our Research Center at /research publishes white papers, case studies, industry reports, and innovation reports.",
  },
  {
    keywords: ["news", "announcement", "press", "newsroom", "company news"],
    answer: "Official company news appears on the home page Newsroom section and at /newsroom. Admin publishes from the admin panel — articles must be marked Published to appear publicly.",
  },
  {
    keywords: ["career", "community member"],
    answer: accountVsCommunity.communitySteps.join(" → "),
  },
  {
    keywords: ["page", "navigate", "where", "find"],
    answer: `Main pages: ${navLinks.map((l) => `${l.label} (${l.href})`).join(", ")}.`,
  },
  {
    keywords: ["terms", "conditions", "legal", "agreement", "contract", "policy", "terms of service"],
    answer: `${termsSections[0].body} Full Terms & Conditions: /terms. ${paymentPolicy.startCondition}.`,
  },
  {
    keywords: ["payment", "pay", "deposit", "60%", "40%", "invoice", "refund", "money", "cost", "price", "mpesa"],
    answer: `${paymentPolicy.channel}. ${paymentPolicy.deposit}. ${paymentPolicy.balance}. Pay invoices in Client Portal → Invoices — enter your Safaricom number for an M-Pesa PIN prompt. Or use /pay?invoice=… from your email link.`,
  },
  {
    keywords: ["revision", "change request", "modify", "update work", "feedback", "correction", "fix my project"],
    answer:
      "Easy! In your portal go to Projects or Services, tap your project, type what you want changed (like \"ensure accountability\"), and hit Send. We get it linked to that exact project.",
  },
  {
    keywords: ["workflow", "track", "progress", "milestone", "schedule", "timeline", "percentage", "portal", "approval", "hod", "finance", "deposit"],
    answer: `Full service workflow: submit idea or solution → admin approves and assigns department (Cyber Security, Software Engineering, AI, IoT, Cloud & DevOps, etc.) → HOD prepares budget & stages → finance adjusts and sends invoice + stages to client → client agrees → 60% deposit → finance starts work → dev team updates progress bar visible to client, admin, and team. ${reviewSla} for initial review. Client portal: /portal/client. Employee portal: /portal/employee. Pipeline stages: ${workflowStages.map((s) => s.label).join(" → ")}.`,
  },
  {
    keywords: ["24 hour", "24hr", "working hours", "review time", "how long", "when will"],
    answer: `Ideas and work requests are verified or rejected ${reviewSla}. After agreement, next steps are emailed and shown in your portal. Invoices include scope and timelines from our Finance Office.`,
  },
  {
    keywords: ["encrypt", "security", "privacy", "data protection", "safe"],
    answer:
      "TechFlare encrypts sensitive personal and submission data at rest in our database (AES-256). Passwords are hashed. Data is transmitted over HTTPS. See /privacy for more.",
  },
  {
    keywords: ["verify", "verification", "otp", "code", "email confirm"],
    answer:
      "After registering, verify your email at /verify-email with the 6-digit code we send. Didn't get it? Use Resend on that page or sign in — we'll send a fresh code. Check spam and Promotions folders too.",
  },
  {
    keywords: ["employee", "staff", "work id", "hod", "developer portal"],
    answer:
      "Employees sign in at /login using the Employee tab with Work ID and password. Your workspace is at /portal/employee — tasks, schedules, and project updates.",
  },
  {
    keywords: ["blog", "write post", "publish article", "innovation story"],
    answer:
      "Read stories at /blog. Innovators with an account can write at /blog/write or from Innovation Portal → Blog. Posts are reviewed before publishing.",
  },
  {
    keywords: ["forgot password", "reset password", "locked out"],
    answer: "Reset your password at /forgot-password — enter your email and follow the secure link we send you.",
  },
  {
    keywords: ["order", "buy product", "purchase product"],
    answer:
      "Browse /products, pick a product, and place an order. Sign in to track orders in Client Portal → Orders. Career Compass is live at https://aipoweredcbeguide.vercel.app/.",
  },
  {
    keywords: ["ticket", "support ticket", "help desk", "technical support"],
    answer:
      "Support tickets are for login problems, billing questions, or when something is broken — not for project changes. Open Client Portal → Support, fill the short form, and our team replies by email and in your portal.",
  },
  {
    keywords: ["accessibility", "accessible", "blind", "visually impaired", "screen reader", "font size", "a11y", "disability"],
    answer:
      "Open the accessibility panel at the bottom-left (green icon) or press Alt+A. Increase text size, turn on the audio guide for spoken navigation, use high contrast, or tap Read this page aloud. Full details at /accessibility.",
  },
  {
    keywords: ["success", "worked", "helpful", "thank", "yes i did", "got it"],
    answer:
      "That's great to hear! If you need anything else — another idea, a product order, or a custom solution — I'm here. You can also reach us at " +
      company.email +
      ".",
  },
  {
    keywords: ["no", "not yet", "still need", "didn't work", "failed", "confused"],
    answer:
      "No worries — let's keep going. Tell me what step you're stuck on, or contact our team directly at " +
      company.email +
      " or WhatsApp " +
      company.phone +
      ". For hands-on help with solutions, visit /solutions or /contact.",
  },
];

export function matchKnowledge(message: string): string | null {
  const lower = message.toLowerCase().trim();
  let best: { score: number; answer: string } | null = null;

  for (const topic of knowledgeTopics) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (lower.includes(kw)) score += kw.length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, answer: topic.answer };
    }
  }

  return best?.answer ?? null;
}

export function resolveChatResponse(message: string): ChatResolution {
  const nav = matchNavigationIntent(message);
  if (nav) return nav;

  const matched = matchKnowledge(message);
  if (matched) return { reply: matched };

  return { reply: creativeFallback(message) };
}

export function buildFollowUpMessage(exactPreviousQuestion: string): string {
  return `Hello again! You previously asked: "${exactPreviousQuestion}" — were you successful with that, or do you still need help?`;
}

export function buildFollowUpNotificationBody(exactPreviousQuestion: string): string {
  const short =
    exactPreviousQuestion.length > 80
      ? `${exactPreviousQuestion.slice(0, 77)}...`
      : exactPreviousQuestion;
  return `Follow-up: Were you successful with "${short}"? Tap to reply.`;
}
