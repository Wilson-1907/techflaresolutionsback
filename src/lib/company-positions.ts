/** Company departments — admin assigns work to these during approval. */
export const DEPARTMENTS = [
  { name: "Cyber Security", slug: "cyber-security", code: "CY", description: "Security audits, penetration testing, compliance" },
  { name: "Software Engineering", slug: "software-engineering", code: "SW", description: "Web, mobile, and enterprise software" },
  { name: "Artificial Intelligence", slug: "artificial-intelligence", code: "AI", description: "ML, AI products, data science" },
  { name: "Cloud & DevOps", slug: "cloud-devops", code: "CL", description: "Infrastructure, deployment, monitoring" },
  { name: "Internet of Things (IoT)", slug: "internet-of-things", code: "IO", description: "Connected devices, sensors, edge computing, and smart systems" },
  { name: "Research & Innovation", slug: "research-innovation", code: "RI", description: "R&D, prototypes, innovation lab" },
  { name: "Finance Office", slug: "finance", code: "FN", description: "Invoicing, treasury, client billing" },
  { name: "Media & Communications", slug: "media", code: "MD", description: "Content, PR, brand communications" },
  { name: "Marketing", slug: "marketing", code: "MK", description: "Campaigns, growth, partnerships" },
  { name: "Human Resources", slug: "human-resources", code: "HR", description: "Recruitment, people operations" },
  { name: "Customer Success", slug: "customer-success", code: "CU", description: "Client support and account management" },
] as const;

export type DepartmentSlug = (typeof DEPARTMENTS)[number]["slug"];

export const STAFF_TIERS = [
  { id: "staff", label: "Staff / Developer", description: "Engineers, analysts, and specialists in the department" },
  { id: "hod", label: "Head of Department (HOD)", description: "Leads one department" },
  { id: "executive", label: "Executive leadership", description: "CIO, CTO, and other senior company roles" },
] as const;

export type StaffTier = (typeof STAFF_TIERS)[number]["id"];

const EXECUTIVE_POSITIONS = [
  "Chief Information Officer (CIO)",
  "Chief Technology Officer (CTO)",
  "Chief Executive Officer (CEO)",
  "Chief Operating Officer (COO)",
  "Managing Director",
] as const;

const HOD_POSITION = "Head of Department (HOD)";

/** Positions per department — staff tier only (not HOD or executive). */
export const DEPARTMENT_STAFF_POSITIONS: Record<DepartmentSlug, readonly string[]> = {
  "cyber-security": [
    "Cyber Security Analyst",
    "Senior Cyber Security Analyst",
    "Penetration Tester",
    "Security Engineer",
  ],
  "software-engineering": [
    "Junior Developer",
    "Software Engineer",
    "Senior Software Engineer",
    "QA Engineer",
    "UI/UX Designer",
    "Technical Lead",
  ],
  "artificial-intelligence": [
    "Junior AI Engineer",
    "AI / ML Engineer",
    "Senior AI / ML Engineer",
    "Data Scientist",
    "MLOps Engineer",
  ],
  "cloud-devops": [
    "DevOps Engineer",
    "Senior DevOps Engineer",
    "Cloud Architect",
    "Site Reliability Engineer",
  ],
  "internet-of-things": [
    "IoT Engineer",
    "Senior IoT Engineer",
    "Embedded Systems Engineer",
    "Firmware Developer",
    "IoT Solutions Architect",
    "Edge & Sensor Integration Specialist",
  ],
  "research-innovation": [
    "Research Analyst",
    "Innovation Lead",
    "Product Manager",
    "Prototype Engineer",
  ],
  finance: ["Finance Officer", "Senior Finance Officer", "Accounts Assistant"],
  media: ["Media Officer", "Content Writer", "Video Producer", "Communications Officer"],
  marketing: ["Digital Marketer", "Marketing Manager", "Growth Specialist", "Brand Coordinator"],
  "human-resources": ["HR Officer", "Recruitment Officer", "People Operations Specialist"],
  "customer-success": [
    "Customer Success Manager",
    "Technical Support Specialist",
    "Client Account Manager",
  ],
};

/** Flat list for backwards compatibility */
export const COMPANY_POSITIONS = [
  ...EXECUTIVE_POSITIONS,
  HOD_POSITION,
  ...Object.values(DEPARTMENT_STAFF_POSITIONS).flat(),
] as const;

export type CompanyPosition = (typeof COMPANY_POSITIONS)[number];

export function getDepartmentSlugById(
  departments: { id: string; slug: string }[],
  departmentId: string
): DepartmentSlug | null {
  const slug = departments.find((d) => d.id === departmentId)?.slug;
  if (!slug || !(slug in DEPARTMENT_STAFF_POSITIONS)) return null;
  return slug as DepartmentSlug;
}

export function getPositionsForDepartment(
  departmentSlug: string | null | undefined,
  tier: StaffTier
): string[] {
  if (tier === "executive") return [...EXECUTIVE_POSITIONS];
  if (tier === "hod") return [HOD_POSITION];
  if (!departmentSlug || !(departmentSlug in DEPARTMENT_STAFF_POSITIONS)) return [];
  return [...DEPARTMENT_STAFF_POSITIONS[departmentSlug as DepartmentSlug]];
}

export function isValidPositionForDepartment(
  departmentSlug: string | null | undefined,
  tier: StaffTier,
  position: string
): boolean {
  return getPositionsForDepartment(departmentSlug, tier).includes(position);
}

export function resolveEmployeeRole(tier: StaffTier, position: string): "EMPLOYEE" | "HOD" | "CIO" | "ADMIN" {
  if (tier === "hod" || position === HOD_POSITION) return "HOD";
  const lower = position.toLowerCase();
  if (tier === "executive" && (lower.includes("cio") || lower.includes("chief information"))) return "CIO";
  return "EMPLOYEE";
}

/** Submission limits — brief but complete to avoid rejection */
export const SUBMISSION_LIMITS = {
  ideaTitleMax: 100,
  ideaDescriptionMax: 500,
  solutionProblemMax: 500,
  ideaDescriptionMin: 40,
  solutionProblemMin: 40,
} as const;

export const SUBMISSION_HINT =
  "Be short but complete: state the problem, who benefits, and what you need. Vague or incomplete submissions may be rejected.";
