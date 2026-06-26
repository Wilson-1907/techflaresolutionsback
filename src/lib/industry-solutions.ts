const industrySolutions: Record<string, string[]> = {
  technology: ["Enterprise platform modernization", "API & integration layer", "Internal tooling and admin consoles"],
  "software-saas": ["Multi-tenant SaaS architecture", "Subscription billing integration", "Customer onboarding portal"],
  "ecommerce-retail": ["E-commerce storefront & checkout", "Inventory & order management", "Marketplace platform"],
  "artificial-intelligence": ["LLM-powered assistant", "Predictive analytics engine", "Intelligent document processing"],
  cybersecurity: ["Identity & access management", "Security monitoring dashboard", "Compliance audit tooling"],
  "cloud-infrastructure": ["Cloud migration roadmap", "DevOps CI/CD pipeline", "Serverless microservices"],
  telecommunications: ["Customer self-service portal", "Billing & provisioning integration", "Network operations dashboard"],
  "blockchain-web3": ["Smart contract development", "Tokenization platform", "On-chain audit & reporting"],
  fintech: ["Payment gateway integration", "Digital banking platform", "Fraud detection & KYC automation"],
  insurance: ["Policy administration system", "Claims workflow automation", "Agent & customer portals"],
  legal: ["Case & matter management", "Document workflow automation", "Client collaboration portal"],
  "marketing-advertising": ["Campaign management platform", "Marketing analytics dashboard", "CRM & lead routing"],
  "human-resources": ["Applicant tracking system", "Employee self-service portal", "Payroll & HRIS integration"],
  education: ["Learning management system", "AI-powered assessment platform", "Student analytics dashboard"],
  healthcare: ["Telemedicine platform", "Patient management system", "Clinical data analytics"],
  pharmaceuticals: ["Regulatory compliance tracking", "Clinical trial data platform", "Supply chain visibility"],
  biotechnology: ["Lab data management", "Research collaboration portal", "Bioinformatics pipeline tooling"],
  agriculture: ["IoT crop monitoring", "Agri-marketplace platform", "Supply chain traceability"],
  government: ["E-governance portal", "Citizen service platform", "Secure document management"],
  nonprofit: ["Donor CRM & fundraising platform", "Program impact dashboard", "Volunteer management system"],
  manufacturing: ["Predictive maintenance IoT", "Production analytics dashboard", "Quality control automation"],
  logistics: ["Fleet management system", "Route optimization engine", "Warehouse management platform"],
  transportation: ["Transit operations platform", "Mobility booking & dispatch", "Fleet telematics integration"],
  construction: ["Project management portal", "Site reporting & compliance", "Contractor collaboration hub"],
  "energy-utilities": ["Smart metering platform", "Grid monitoring dashboard", "Customer billing portal"],
  mining: ["Field operations tracking", "Safety & compliance system", "Resource planning analytics"],
  environmental: ["ESG reporting dashboard", "Carbon tracking platform", "Environmental sensor integration"],
  hospitality: ["Booking & reservation engine", "Property management system", "Guest experience app"],
  "real-estate": ["Property listing marketplace", "Tenant & lease management", "Transaction workflow portal"],
  "media-entertainment": ["Streaming & content platform", "Rights & royalty management", "Audience analytics dashboard"],
  sports: ["League & event management", "Fan engagement app", "Performance analytics platform"],
  "food-beverage": ["Restaurant POS & ordering", "Kitchen display integration", "Supply chain ordering portal"],
  fashion: ["E-commerce & lookbook platform", "Inventory & SKU management", "Brand wholesale portal"],
  automotive: ["Dealer management system", "Connected vehicle dashboard", "Parts & service marketplace"],
  "aerospace-defense": ["Mission planning software", "Secure communications platform", "Simulation & training systems"],
};

const defaultSolutions = [
  "Custom software platform tailored to your sector",
  "AI-powered workflow automation",
  "Cloud-native architecture and third-party integrations",
];

export function solutionsForIndustry(industry: string): string[] {
  return industrySolutions[industry] ?? defaultSolutions;
}
