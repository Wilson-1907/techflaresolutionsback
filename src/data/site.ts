export const company = {
  name: "TechFlare Solutions",
  tagline: "IGNITING INNOVATIONS, DELIVERING SOLUTIONS",
  mission:
    "To bridge the gap between groundbreaking ideas and world-class technology solutions through rigorous research, innovative engineering, and relentless execution.",
  vision:
    "To become the global leader in idea-to-solution transformation, empowering innovators, businesses, and governments to solve humanity's most pressing challenges.",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "stechflare@gmail.com",
  solutionsEmail: process.env.NEXT_PUBLIC_SOLUTIONS_EMAIL || "stechflare@gmail.com",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE?.replace(/\s/g, "") || "+254117880494",
  phoneLocal: "+254117880494",
  whatsapp: "254117880494",
  whatsappLink: "https://wa.me/254117880494",
  communityWhatsApp: "https://chat.whatsapp.com/HaexOE7SYvMJBdjruVmDJo",
  social: {
    handle: "techflare_solutions",
    links: [
      { id: "instagram", name: "Instagram", handle: "techflare_solutions", href: "#" },
      { id: "facebook", name: "Facebook", handle: "techflare_solutions", href: "#" },
      { id: "tiktok", name: "TikTok", handle: "techflare_solutions", href: "#" },
      { id: "x", name: "X", handle: "techflare_solutions", href: "#" },
      { id: "linkedin", name: "LinkedIn", handle: "techflare_solutions", href: "#" },
      { id: "youtube", name: "YouTube", handle: "techflare_solutions", href: "#" },
    ],
  },
  country: "Kenya",
  locationNote: "Kenya — Online & physical offices",
  offices: [
    { city: "Karatina", country: "Kenya", address: "TechFlare Solutions Office, Karatina" },
    { city: "Nyeri", country: "Kenya", address: "TechFlare Solutions Office, Nyeri" },
  ],
  pointsRate: 0.05,
  pointsDescription:
    "Registered clients earn TechFlare Points equal to 5% of profit value on qualifying projects. Redeem points for product discounts, awards, and exclusive benefits.",
  founded: "1 July 2026",
  mpesaTill: "9356451",
  mpesaTillName: "TechFlare Solutions",
};

export const founder = {
  name: "Kinyanjui Wilson",
  role: "CEO & Founder · AI Engineer",
  image: "/kinyanjui-wilson.png",
  bio: "Founded TechFlare Solutions on 1 July 2026. AI Engineer based in Kenya.",
};

export const accountVsCommunity = {
  accountTitle: "Create an Account",
  accountDescription:
    "Signing up gives you a secure TechFlare portal — track projects, submit ideas, use our AI tools, and earn client reward points. This is your private workspace with us.",
  communityTitle: "Join Our Community",
  communityDescription:
    "Our community is separate from your website account. Join our WhatsApp group to receive notifications, share your email for activity updates, and access careers and innovation programs.",
  communitySteps: [
    "Create your TechFlare account (recommended for portal and points)",
    "Join our WhatsApp community via the official link",
    "Share your email in the group for notifications and event reminders",
    "Apply for careers and participate in community innovation activities",
  ],
};

export const coreValues = [
  { title: "Innovation First", description: "Every challenge is an opportunity to pioneer something extraordinary." },
  { title: "Research-Driven", description: "Decisions backed by data, analysis, and rigorous methodology." },
  { title: "Client Partnership", description: "We succeed only when our clients achieve transformative outcomes." },
  { title: "Integrity", description: "Transparency and ethical practices in every engagement." },
  { title: "Excellence", description: "World-class standards in every line of code and every deliverable." },
  { title: "Global Impact", description: "Technology that serves communities and advances humanity." },
];

export const logoSymbols = [
  {
    name: "Golden Lion",
    meaning:
      "Strength, leadership, and courage — representing our commitment to bold innovation and protecting the ideas we build.",
  },
  {
    name: "Globe",
    meaning:
      "Global reach and universal impact — technology that connects communities and serves humanity across borders.",
  },
  {
    name: "Circuit Lines",
    meaning:
      "Lines of code and digital connectivity — the engineering foundation that powers every solution we deliver.",
  },
  {
    name: "Gold Ring",
    meaning:
      "Excellence and premium quality — a standard of craftsmanship in every project, product, and partnership.",
  },
  {
    name: "Tagline — IGNITING INNOVATIONS, DELIVERING SOLUTIONS",
    meaning:
      "Our promise to spark bold ideas and ship dependable technology — from first concept through delivery.",
  },
];

export const services = [
  {
    slug: "innovation-consulting",
    title: "Innovation Consulting",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80&auto=format&fit=crop",
    description: "Strategic guidance to transform ideas into viable products.",
  },
  {
    slug: "software-development",
    title: "Software Development",
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80&auto=format&fit=crop",
    description: "Custom applications built with cutting-edge technologies.",
  },
  {
    slug: "ai-solutions",
    title: "AI Solutions",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80&auto=format&fit=crop",
    description: "Machine learning, NLP, and intelligent automation systems.",
  },
  {
    slug: "data-engineering",
    title: "Data Engineering",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80&auto=format&fit=crop",
    description: "Pipelines, warehouses, and analytics infrastructure.",
  },
  {
    slug: "cloud-solutions",
    title: "Cloud Solutions",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80&auto=format&fit=crop",
    description: "AWS, Azure, and GCP architecture and migration.",
  },
  {
    slug: "internet-of-things",
    title: "Internet of Things (IoT)",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&auto=format&fit=crop",
    description: "Connected devices, sensors, edge gateways, and smart monitoring systems.",
  },
  {
    slug: "cybersecurity",
    title: "Cybersecurity",
    image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80&auto=format&fit=crop",
    description: "Threat assessment, compliance, and security architecture.",
  },
  {
    slug: "research-development",
    title: "Research & Development",
    image: "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&q=80&auto=format&fit=crop",
    description: "Applied research and prototype development.",
  },
  {
    slug: "product-development",
    title: "Product Development",
    image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80&auto=format&fit=crop",
    description: "End-to-end product lifecycle from concept to launch.",
  },
];

export const industries = [
  { slug: "technology", title: "Technology", icon: "💻", description: "Enterprise software, digital platforms, and IT modernization for technology-driven organizations." },
  { slug: "software-saas", title: "Software & SaaS", icon: "☁️", description: "Product engineering, multi-tenant SaaS, APIs, and scalable cloud-native applications." },
  { slug: "ecommerce-retail", title: "E-Commerce & Retail", icon: "🛒", description: "Online stores, marketplaces, inventory systems, payments, and omnichannel retail technology." },
  { slug: "artificial-intelligence", title: "Artificial Intelligence", icon: "🤖", description: "Machine learning, LLM integration, intelligent automation, and AI-powered decision systems." },
  { slug: "cybersecurity", title: "Cybersecurity", icon: "🔐", description: "Security architecture, identity management, threat monitoring, and compliance-ready systems." },
  { slug: "cloud-infrastructure", title: "Cloud & Infrastructure", icon: "🌐", description: "Cloud migration, DevOps, serverless architecture, and resilient infrastructure design." },
  { slug: "internet-of-things", title: "Internet of Things (IoT)", icon: "📟", description: "Smart sensors, connected devices, edge computing, telemetry dashboards, and industrial IoT platforms." },
  { slug: "telecommunications", title: "Telecommunications", icon: "📡", description: "Network services, customer platforms, billing integration, and connectivity solutions." },
  { slug: "blockchain-web3", title: "Blockchain & Web3", icon: "⛓️", description: "Distributed ledgers, smart contracts, tokenization, and decentralized application development." },
  { slug: "fintech", title: "Fintech & Banking", icon: "🏦", description: "Digital banking, payment gateways, lending platforms, and regulatory-compliant fintech products." },
  { slug: "insurance", title: "Insurance", icon: "🛡️", description: "Policy management, claims automation, underwriting tools, and customer self-service portals." },
  { slug: "legal", title: "Legal & Compliance", icon: "⚖️", description: "Case management, document workflows, e-discovery, and governance technology." },
  { slug: "marketing-advertising", title: "Marketing & Advertising", icon: "📣", description: "Campaign platforms, analytics dashboards, CRM integrations, and growth technology stacks." },
  { slug: "human-resources", title: "Human Resources", icon: "👥", description: "Recruitment systems, payroll integration, performance management, and workforce platforms." },
  { slug: "education", title: "Education", icon: "🎓", description: "Digital learning platforms, examination security, campus management, and EdTech products." },
  { slug: "healthcare", title: "Healthcare", icon: "🏥", description: "Patient management, telemedicine, electronic health records, and clinical data analytics." },
  { slug: "pharmaceuticals", title: "Pharmaceuticals", icon: "💊", description: "Research data systems, regulatory tracking, supply chain visibility, and patient programs." },
  { slug: "biotechnology", title: "Biotechnology & Life Sciences", icon: "🧬", description: "Lab informatics, research collaboration platforms, and bio-data analysis tools." },
  { slug: "agriculture", title: "Agriculture", icon: "🌾", description: "Smart farming, crop monitoring, agri-marketplaces, and supply chain optimization." },
  { slug: "government", title: "Government & Public Sector", icon: "🏛️", description: "E-governance, secure voting, citizen service portals, and public-sector digital transformation." },
  { slug: "nonprofit", title: "Nonprofit & NGOs", icon: "🤝", description: "Donor management, program tracking, volunteer platforms, and impact reporting systems." },
  { slug: "manufacturing", title: "Manufacturing", icon: "🏭", description: "IoT integration, predictive maintenance, quality control, and production analytics." },
  { slug: "logistics", title: "Logistics & Supply Chain", icon: "🚚", description: "Fleet management, route optimization, warehouse automation, and last-mile delivery tech." },
  { slug: "transportation", title: "Transportation & Mobility", icon: "🚌", description: "Transit systems, ride platforms, fleet operations, and mobility-as-a-service solutions." },
  { slug: "construction", title: "Construction & Engineering", icon: "🏗️", description: "Project management, BIM workflows, site monitoring, and contractor collaboration tools." },
  { slug: "energy-utilities", title: "Energy & Utilities", icon: "⚡", description: "Smart grid systems, metering platforms, renewable energy monitoring, and utility billing." },
  { slug: "mining", title: "Mining & Natural Resources", icon: "⛏️", description: "Operations tracking, safety systems, resource planning, and field data collection." },
  { slug: "environmental", title: "Environmental & Sustainability", icon: "🌱", description: "Carbon tracking, ESG reporting, environmental monitoring, and sustainability dashboards." },
  { slug: "hospitality", title: "Hospitality & Tourism", icon: "🏨", description: "Booking engines, property management, guest experience apps, and travel platforms." },
  { slug: "real-estate", title: "Real Estate & PropTech", icon: "🏠", description: "Property listings, tenant management, smart building systems, and transaction platforms." },
  { slug: "media-entertainment", title: "Media & Entertainment", icon: "🎬", description: "Streaming platforms, content management, audience analytics, and digital publishing." },
  { slug: "sports", title: "Sports & Recreation", icon: "⚽", description: "League management, fan engagement apps, performance analytics, and event ticketing." },
  { slug: "food-beverage", title: "Food & Beverage", icon: "🍽️", description: "Restaurant tech, order management, kitchen systems, and food supply chain platforms." },
  { slug: "fashion", title: "Fashion & Apparel", icon: "👗", description: "E-commerce storefronts, inventory planning, brand portals, and retail experience apps." },
  { slug: "automotive", title: "Automotive & Mobility Tech", icon: "🚗", description: "Dealer systems, connected vehicle platforms, fleet tech, and automotive marketplaces." },
  { slug: "aerospace-defense", title: "Aerospace & Defense", icon: "✈️", description: "Mission systems, secure communications, simulation tools, and defense-grade software." },
];

export type ProductStatus = "live" | "in-development" | "coming-soon";

export interface Product {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: ProductStatus;
  image?: string;
  externalUrl?: string;
  features: string[];
  howItWorks?: string[];
  pricing?: { starter?: number | string; professional?: number | string; enterprise?: number | string };
}

export const productStatusLabels: Record<ProductStatus, string> = {
  live: "Live Now",
  "in-development": "In Development",
  "coming-soon": "Coming Soon",
};

export const products: Product[] = [
  {
    slug: "career-compass-cbe",
    title: "Career Compass",
    tagline: "AI-Powered CBE Career Guide for Kenyan Students",
    description:
      "Career Compass helps students navigate Kenya's Competency-Based Education system with confidence. Built by TechFlare Solutions, it uses AI to analyze interests, skills, and aspirations — delivering personalized career pathway recommendations, expert counseling connections, and interactive scenario learning.",
    status: "live",
    externalUrl: "https://aipoweredcbeguide.vercel.app/",
    image: "/products/career-compass.svg",
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
  },
  {
    slug: "biometric-voting-system",
    title: "Biometric Voting System",
    tagline: "Secure, transparent elections built for Kenya",
    description:
      "TechFlare Solutions is actively developing a next-generation biometric voting platform designed for institutional and national-scale elections. Voters authenticate via secure biometric identity, cast encrypted votes, and results are tallied with full audit trails — built with IEBC-grade security standards in mind.",
    status: "in-development",
    image: "/products/biometric-voting-system.png",
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
  },
];

export const innovationWorkflow = [
  {
    step: 1,
    phase: "Spark",
    title: "Idea Submission",
    description: "Share your idea, invention, or business concept with our team.",
    hint: "Every breakthrough starts with a single spark.",
  },
  {
    step: 2,
    phase: "Discover",
    title: "Research Review",
    description: "Our research team conducts preliminary analysis and market scan.",
    hint: "We map the landscape before we build the path.",
  },
  {
    step: 3,
    phase: "Assess",
    title: "Risk Assessment",
    description: "Technical, financial, and operational risks are evaluated.",
    hint: "Clear-eyed analysis — no surprises down the road.",
  },
  {
    step: 4,
    phase: "Prove",
    title: "Feasibility Analysis",
    description: "Deep-dive into technical viability, resources, and timeline.",
    hint: "From concept to blueprint with real engineering rigor.",
  },
  {
    step: 5,
    phase: "Launch",
    title: "Decision",
    description: "Partnership proposal, development plan, or constructive feedback.",
    hint: "You leave with a clear next step — not a dead end.",
  },
];

export const navLinks = [
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/industries", label: "Industries" },
  { href: "/products", label: "Products" },
  { href: "/innovation-hub", label: "Innovation Hub", highlight: true },
  { href: "/solutions", label: "Solutions" },
  { href: "/research", label: "Research" },
  { href: "/careers", label: "Careers" },
  { href: "/blog", label: "Blog" },
  { href: "/newsroom", label: "Newsroom" },
  { href: "/community", label: "Community" },
  { href: "/contact", label: "Contact" },
];
