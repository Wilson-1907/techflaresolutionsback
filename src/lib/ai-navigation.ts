import { company, innovationWorkflow } from "@/data/site";
import { reviewSla } from "@/data/policies";

export type ChatAction = {
  type: "navigate";
  path: string;
  label: string;
  /** When true the assistant navigates immediately (e.g. "where do I…"). */
  auto: boolean;
};

export type ChatResolution = {
  reply: string;
  action?: ChatAction;
};

type NavIntent = {
  id: string;
  direct: RegExp[];
  how: RegExp[];
  path: string;
  label: string;
  explain: string;
};

const NAV_INTENTS: NavIntent[] = [
  {
    id: "innovation-submit",
    direct: [
      /where\s+(can\s+i\s+|do\s+i\s+|to\s+)?submit\s+(my\s+)?(innovation|idea|invention|concept)/i,
      /where\s+(can\s+i\s+|do\s+i\s+)?(send|upload)\s+(my\s+)?(innovation|idea|invention)/i,
      /take\s+me\s+to\s+.*(submit|innovation|idea)/i,
      /(open|go\s+to|direct\s+me\s+to)\s+.*(innovation\s+submit|submit\s+idea)/i,
    ],
    how: [
      /how\s+(can\s+i\s+|do\s+i\s+|to\s+)?submit\s+(my\s+)?(innovation|idea|invention|concept)/i,
      /how\s+.*(innovation\s+hub|submit\s+an?\s+idea)/i,
      /steps?\s+to\s+submit\s+(my\s+)?(idea|innovation)/i,
    ],
    path: "/portal/innovation/submit",
    label: "Innovation submit form",
    explain: `To submit your idea: (1) Sign up free at /register — pick Innovator. (2) Check your email for a code. (3) Go to Submit and tell us about your idea. We reply within 24 working hours.`,
  },
  {
    id: "client-submit",
    direct: [
      /where\s+(can\s+i\s+|do\s+i\s+|to\s+)?submit\s+(my\s+)?(project|request|work|solution|job|brief)/i,
      /where\s+(can\s+i\s+|do\s+i\s+)?(send|upload)\s+(my\s+)?(project|request|work)/i,
      /take\s+me\s+to\s+.*(client\s+submit|submit\s+request|submit\s+project)/i,
    ],
    how: [
      /how\s+(can\s+i\s+|do\s+i\s+|to\s+)?submit\s+(my\s+)?(project|request|work|solution|brief)/i,
      /how\s+.*(request\s+a\s+solution|client\s+portal\s+submit)/i,
    ],
    path: "/portal/client/submit",
    label: "Client request form",
    explain: `To send a work request: (1) Sign up at /register as Client. (2) Verify email. (3) Open Submit and describe what you need. We review it and email you if approved.`,
  },
  {
    id: "innovation-hub",
    direct: [
      /where\s+is\s+(the\s+)?innovation\s+hub/i,
      /take\s+me\s+to\s+(the\s+)?innovation\s+hub/i,
      /open\s+innovation\s+hub/i,
    ],
    how: [
      /what\s+is\s+(the\s+)?innovation\s+hub/i,
      /how\s+does\s+(the\s+)?innovation\s+hub\s+work/i,
    ],
    path: "/innovation-hub",
    label: "Innovation Hub",
    explain: `The Innovation Hub (/innovation-hub) is where inventors and entrepreneurs explore our pipeline and start submissions. Sign in to submit; track progress at /portal/innovation.`,
  },
  {
    id: "solutions",
    direct: [
      /where\s+(can\s+i\s+|do\s+i\s+)?(get\s+a\s+)?(proposal|solution\s+plan)/i,
      /take\s+me\s+to\s+solutions/i,
      /open\s+solutions(\s+center)?/i,
    ],
    how: [
      /how\s+(can\s+i\s+|do\s+i\s+)?(get\s+a\s+)?(proposal|solution)/i,
      /how\s+does\s+(the\s+)?solutions\s+center\s+work/i,
    ],
    path: "/solutions",
    label: "Solutions Center",
    explain:
      "Visit /solutions, sign in, and describe your business problem — our AI proposal generator drafts a preliminary plan. Our team follows up within 48 hours.",
  },
  {
    id: "register",
    direct: [
      /where\s+(can\s+i\s+|do\s+i\s+)?(sign\s+up|register|create\s+an?\s+account)/i,
      /take\s+me\s+to\s+register/i,
      /open\s+(the\s+)?registration/i,
    ],
    how: [
      /how\s+(can\s+i\s+|do\s+i\s+)?(sign\s+up|register|create\s+an?\s+account)/i,
      /how\s+to\s+join\s+techflare/i,
    ],
    path: "/register",
    label: "Create account",
    explain:
      "Register at /register — choose Client (projects & solutions) or Innovator (ideas & inventions). You'll verify email with a one-time code, then access your portal.",
  },
  {
    id: "login",
    direct: [
      /where\s+(can\s+i\s+|do\s+i\s+)?(sign\s+in|log\s*in)/i,
      /take\s+me\s+to\s+log\s*in/i,
      /open\s+(the\s+)?login/i,
    ],
    how: [/how\s+(can\s+i\s+|do\s+i\s+)?(sign\s+in|log\s*in)/i],
    path: "/login",
    label: "Sign in",
    explain:
      "Sign in at /login — Email tab for clients and innovators (email + password), or Employee tab with Work ID for staff.",
  },
  {
    id: "invoices",
    direct: [
      /where\s+(can\s+i\s+|do\s+i\s+)?(pay|view)\s+(my\s+)?invoice/i,
      /take\s+me\s+to\s+.*invoice/i,
      /where\s+.*pay\s+(my\s+)?(bill|invoice|deposit)/i,
    ],
    how: [
      /how\s+(can\s+i\s+|do\s+i\s+)?pay\s+(an?\s+)?invoice/i,
      /how\s+.*mpesa/i,
      /how\s+to\s+pay\s+(techflare|deposit)/i,
    ],
    path: "/portal/client/invoices",
    label: "Invoices & pay",
    explain:
      "Go to Billing & Pay in your portal. Tap Pay on your invoice, enter your Safaricom number, and type your M-Pesa PIN on your phone.",
  },
  {
    id: "client-portal",
    direct: [
      /where\s+is\s+(my\s+)?client\s+portal/i,
      /take\s+me\s+to\s+(my\s+)?client\s+portal/i,
      /open\s+client\s+portal/i,
    ],
    how: [/how\s+(can\s+i\s+)?use\s+(the\s+)?client\s+portal/i],
    path: "/portal/client",
    label: "Client portal",
    explain:
      "Your Client Portal at /portal/client tracks projects, invoices, orders, support tickets, and revision requests.",
  },
  {
    id: "innovation-portal",
    direct: [
      /where\s+is\s+(my\s+)?innovation\s+portal/i,
      /take\s+me\s+to\s+(my\s+)?innovation\s+portal/i,
    ],
    how: [/how\s+(can\s+i\s+)?track\s+(my\s+)?(idea|innovation)/i],
    path: "/portal/innovation",
    label: "Innovation portal",
    explain:
      "Your Innovation Portal at /portal/innovation shows submission tracking, documents, agreements, and progress.",
  },
  {
    id: "products",
    direct: [/where\s+(are\s+)?(your\s+)?products/i, /take\s+me\s+to\s+products/i],
    how: [/how\s+(can\s+i\s+)?(order|buy)\s+(a\s+)?product/i],
    path: "/products",
    label: "Products",
    explain: "Browse TechFlare products at /products — order in-portal or on product pages. Career Compass is live at https://aipoweredcbeguide.vercel.app/.",
  },
  {
    id: "careers",
    direct: [/where\s+(can\s+i\s+)?apply(\s+for\s+a\s+job)?/i, /take\s+me\s+to\s+careers/i],
    how: [/how\s+(can\s+i\s+)?apply(\s+for\s+a\s+job)?/i, /how\s+to\s+join\s+(the\s+)?team/i],
    path: "/careers",
    label: "Careers",
    explain:
      "Careers are at /careers. Join our WhatsApp community first, confirm membership at /community, then apply.",
  },
  {
    id: "contact",
    direct: [/where\s+(can\s+i\s+)?contact/i, /take\s+me\s+to\s+contact/i],
    how: [/how\s+(can\s+i\s+)?reach\s+(you|techflare)/i],
    path: "/contact",
    label: "Contact us",
    explain: `Reach us at ${company.email} or ${company.phone} (call & WhatsApp). Offices in ${company.offices.map((o) => o.city).join(" & ")}, Kenya.`,
  },
  {
    id: "community",
    direct: [/where\s+(is\s+)?(the\s+)?whatsapp\s+community/i, /take\s+me\s+to\s+community/i],
    how: [/how\s+(can\s+i\s+)?join\s+(the\s+)?(whatsapp\s+)?community/i],
    path: "/community",
    label: "Community",
    explain: `Community membership is separate from your account. Join WhatsApp: ${company.communityWhatsApp}, then confirm at /community.`,
  },
  {
    id: "terms",
    direct: [/where\s+(are\s+)?(the\s+)?terms/i],
    how: [/what\s+are\s+(your\s+)?terms/i, /payment\s+policy/i],
    path: "/terms",
    label: "Terms & payment policy",
    explain: "Full Terms & Conditions and payment policy (60/40 deposit, M-Pesa Till) are at /terms.",
  },
  {
    id: "about",
    direct: [/where\s+(is\s+)?(the\s+)?about(\s+page)?/i, /take\s+me\s+to\s+about/i],
    how: [/who\s+(is|are)\s+techflare/i, /tell\s+me\s+about\s+techflare/i],
    path: "/about",
    label: "About TechFlare",
    explain: `${company.name}: "${company.tagline}". Learn our mission, values, and founder story at /about.`,
  },
  {
    id: "services",
    direct: [/where\s+(are\s+)?(your\s+)?services/i, /take\s+me\s+to\s+services/i],
    how: [/what\s+services\s+(do\s+you\s+)?offer/i],
    path: "/services",
    label: "Services",
    explain: "Our services cover research, software engineering, AI, cybersecurity, and deployment. Explore each offering at /services.",
  },
  {
    id: "industries",
    direct: [/where\s+(are\s+)?(your\s+)?industries/i, /take\s+me\s+to\s+industries/i],
    how: [/which\s+industries\s+(do\s+you\s+)?serve/i],
    path: "/industries",
    label: "Industries",
    explain: "We serve technology, e-commerce, fintech, healthcare, education, government, and more — see /industries.",
  },
  {
    id: "research",
    direct: [/where\s+(is\s+)?(the\s+)?research(\s+center)?/i, /take\s+me\s+to\s+research/i],
    how: [/how\s+(can\s+i\s+)?(read|find)\s+(your\s+)?(white\s+papers|research)/i],
    path: "/research",
    label: "Research Center",
    explain: "White papers, case studies, and industry reports live at /research.",
  },
  {
    id: "newsroom",
    direct: [/where\s+(is\s+)?(the\s+)?news(room)?/i, /take\s+me\s+to\s+news/i],
    how: [/how\s+(can\s+i\s+)?(see|read)\s+(company\s+)?news/i],
    path: "/newsroom",
    label: "Newsroom",
    explain: "Official announcements and press updates are at /newsroom and on our home page Newsroom section.",
  },
  {
    id: "blog",
    direct: [/where\s+(is\s+)?(the\s+)?blog/i, /take\s+me\s+to\s+(the\s+)?blog/i],
    how: [/how\s+(can\s+i\s+)?(write|publish)\s+(a\s+)?blog/i],
    path: "/blog",
    label: "Blog",
    explain: "Read innovation stories at /blog. Signed-in innovators can write posts from the Innovation Portal or /blog/write.",
  },
  {
    id: "privacy",
    direct: [/where\s+(is\s+)?(the\s+)?privacy(\s+policy)?/i, /take\s+me\s+to\s+privacy/i],
    how: [/how\s+(do\s+you\s+)?protect\s+my\s+data/i],
    path: "/privacy",
    label: "Privacy policy",
    explain: "We encrypt sensitive data at rest (AES-256), hash passwords, and use HTTPS. Full details at /privacy.",
  },
  {
    id: "verify-email",
    direct: [/where\s+(do\s+i\s+)?(enter|verify)\s+(my\s+)?(otp|code)/i, /take\s+me\s+to\s+verify/i],
    how: [/how\s+(do\s+i\s+)?verify\s+(my\s+)?email/i, /didn'?t\s+get\s+(the\s+)?(otp|code)/i],
    path: "/verify-email",
    label: "Email verification",
    explain: "After registering, enter the 6-digit code from your email at /verify-email. Didn't receive it? Use Resend on that page or sign in to trigger a new code.",
  },
  {
    id: "forgot-password",
    direct: [/where\s+(can\s+i\s+)?reset\s+(my\s+)?password/i, /take\s+me\s+to\s+reset/i],
    how: [/how\s+(do\s+i\s+)?(reset|recover)\s+(my\s+)?password/i, /forgot\s+password/i],
    path: "/forgot-password",
    label: "Password reset",
    explain: "Go to /forgot-password, enter your email, and follow the reset link we send you.",
  },
  {
    id: "pay-page",
    direct: [/where\s+(can\s+i\s+)?pay(\s+online)?/i, /take\s+me\s+to\s+pay/i, /open\s+payment\s+page/i],
    how: [/how\s+(does\s+)?mpesa\s+payment\s+work/i],
    path: "/pay",
    label: "Payment page",
    explain: "Use /pay with your invoice link from email, or Client Portal → Invoices → Pay. Enter your Safaricom number — M-Pesa sends a PIN prompt to your phone.",
  },
  {
    id: "employee-portal",
    direct: [/where\s+(is\s+)?(the\s+)?employee\s+portal/i, /take\s+me\s+to\s+employee/i],
    how: [/how\s+(do\s+)?employees\s+log\s*in/i],
    path: "/portal/employee",
    label: "Employee portal",
    explain: "Staff sign in at /login using the Employee tab with Work ID and password, then access /portal/employee.",
  },
  {
    id: "client-support",
    direct: [/where\s+(is\s+)?(the\s+)?support/i, /take\s+me\s+to\s+support/i, /open\s+a\s+ticket/i],
    how: [/how\s+(do\s+i\s+)?(get\s+)?help/i, /what\s+is\s+a\s+support\s+ticket/i, /something\s+broken/i],
    path: "/portal/client/support",
    label: "Support",
    explain:
      "Support tickets are for login, billing, or when something is broken — not for project changes. Go to Support in your portal, fill the form, and we reply by email.",
  },
  {
    id: "accessibility",
    direct: [/where\s+(are\s+)?(the\s+)?accessibility(\s+options|\s+settings)?/i, /take\s+me\s+to\s+accessibility/i],
    how: [/how\s+(can\s+i\s+)?(increase|change)\s+(the\s+)?font/i, /how\s+(do\s+)?blind\s+(people\s+)?use/i, /audio\s+guide/i],
    path: "/accessibility",
    label: "Accessibility",
    explain:
      "Press Alt+A or tap the green accessibility icon (bottom-left). Increase text size, enable the audio personal assistant, high contrast, and Read this page aloud. Settings are saved in your browser.",
  },
];

/** Loose aliases for “take me to …” / “open …” when no structured intent matched. */
const QUICK_PAGE_ALIASES: { aliases: string[]; path: string; label: string }[] = [
  { aliases: ["home", "homepage", "main page"], path: "/", label: "Home" },
  { aliases: ["register", "sign up", "signup", "create account"], path: "/register", label: "Register" },
  { aliases: ["login", "sign in", "signin"], path: "/login", label: "Sign in" },
  { aliases: ["innovation submit", "submit innovation", "submit idea", "submit my idea"], path: "/portal/innovation/submit", label: "Innovation submit" },
  { aliases: ["client submit", "submit project", "submit request", "submit work", "submit my work"], path: "/portal/client/submit", label: "Client submit" },
  { aliases: ["invoices", "my invoices", "pay invoice", "billing"], path: "/portal/client/invoices", label: "Invoices" },
  { aliases: ["client portal", "my portal"], path: "/portal/client", label: "Client portal" },
  { aliases: ["innovation portal", "track idea", "track innovation"], path: "/portal/innovation", label: "Innovation portal" },
  { aliases: ["innovation hub", "hub"], path: "/innovation-hub", label: "Innovation Hub" },
  { aliases: ["solutions", "solutions center", "ai proposal"], path: "/solutions", label: "Solutions" },
  { aliases: ["products", "shop", "store"], path: "/products", label: "Products" },
  { aliases: ["careers", "jobs", "apply"], path: "/careers", label: "Careers" },
  { aliases: ["community", "whatsapp"], path: "/community", label: "Community" },
  { aliases: ["contact", "support", "help desk"], path: "/contact", label: "Contact" },
  { aliases: ["terms", "payment policy"], path: "/terms", label: "Terms" },
  { aliases: ["about", "who are you"], path: "/about", label: "About" },
  { aliases: ["services"], path: "/services", label: "Services" },
  { aliases: ["industries"], path: "/industries", label: "Industries" },
  { aliases: ["research"], path: "/research", label: "Research" },
  { aliases: ["news", "newsroom"], path: "/newsroom", label: "Newsroom" },
  { aliases: ["blog"], path: "/blog", label: "Blog" },
  { aliases: ["privacy"], path: "/privacy", label: "Privacy" },
  { aliases: ["verify email", "verify-email", "otp"], path: "/verify-email", label: "Verify email" },
  { aliases: ["forgot password", "reset password"], path: "/forgot-password", label: "Reset password" },
  { aliases: ["accessibility", "a11y", "font size", "audio guide"], path: "/accessibility", label: "Accessibility" },
];

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

function matchGenericTakeMe(message: string): ChatResolution | null {
  const m = message.trim();
  const takeMe =
    /^(?:please\s+)?(?:take\s+me\s+to|go\s+to|open|show\s+me|direct\s+me\s+to|navigate\s+to)\s+(?:the\s+)?(.+?)\.?$/i.exec(m) ||
    /^i\s+want\s+to\s+(?:go\s+to|visit|open)\s+(?:the\s+)?(.+?)\.?$/i.exec(m);
  if (!takeMe) return null;

  const target = takeMe[1].toLowerCase().replace(/\s+page$/, "").trim();
  const hit = QUICK_PAGE_ALIASES.find((p) =>
    p.aliases.some((a) => target === a || target.includes(a) || a.includes(target))
  );
  if (!hit) return null;

  return {
    reply: `Taking you to ${hit.label} now — one moment!`,
    action: { type: "navigate", path: hit.path, label: hit.label, auto: true },
  };
}

export function matchNavigationIntent(message: string): ChatResolution | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  for (const intent of NAV_INTENTS) {
    if (matchesAny(trimmed, intent.direct)) {
      return {
        reply: `Taking you to ${intent.label} now — one moment!`,
        action: { type: "navigate", path: intent.path, label: intent.label, auto: true },
      };
    }
    if (matchesAny(trimmed, intent.how)) {
      return {
        reply: `${intent.explain}\n\nWould you like me to take you there now? Tap the button below.`,
        action: { type: "navigate", path: intent.path, label: `Take me to ${intent.label}`, auto: false },
      };
    }
  }

  return matchGenericTakeMe(trimmed);
}

const AFFIRMATIVE =
  /^(yes|yeah|yep|yup|sure|ok|okay|please|take me|go ahead|do it|y|absolutely|definitely|let'?s go|yes please|yes take me|please do)(\s+please)?\.?!?$/i;

export function matchNavigationConfirmation(
  message: string,
  pendingPath?: string
): ChatResolution | null {
  if (!pendingPath || !AFFIRMATIVE.test(message.trim())) return null;
  const intent = NAV_INTENTS.find((i) => i.path === pendingPath);
  return {
    reply: intent ? `Great — opening ${intent.label} for you now!` : "Opening that page for you now!",
    action: {
      type: "navigate",
      path: pendingPath,
      label: intent?.label ?? "Continue",
      auto: true,
    },
  };
}

export function creativeFallback(message: string): string {
  const topic = message.trim().slice(0, 60);
  return (
    `Great question${topic ? ` about "${topic}${message.length > 60 ? "…" : ""}"` : ""}! ` +
    `Here are smart next steps: explore our Innovation Hub for ideas, Solutions Center for business problems, or Products for ready-made tools. ` +
    `Our humans at ${company.email} or WhatsApp ${company.phone} love detailed questions — mention what you asked and we will follow up. ` +
    `You can also say "take me to contact" or "how do I submit my innovation" and I will guide you step by step.`
  );
}
