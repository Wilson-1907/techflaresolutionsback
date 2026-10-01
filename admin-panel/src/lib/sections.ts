import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Newspaper,
  Users,
  FolderKanban,
  Lightbulb,
  Package,
  DollarSign,
  HeadphonesIcon,
  BarChart3,
  Settings,
  UserCircle,
  Briefcase,
  Mail,
  Heart,
} from "lucide-react";

export type SectionId =
  | "crm"
  | "projects"
  | "clients"
  | "employees"
  | "innovation"
  | "products"
  | "finance"
  | "support"
  | "analytics"
  | "settings"
  | "community"
  | "careers";

export interface NavSection {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const mainNav: NavSection[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/news", label: "News & Announcements", icon: Newspaper },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: UserCircle },
  { href: "/employees", label: "Employees", icon: Briefcase },
  { href: "/innovation", label: "Innovation", icon: Lightbulb },
  { href: "/products", label: "Product Orders", icon: Package },
  { href: "/finance", label: "Finance", icon: DollarSign },
  { href: "/support", label: "Support", icon: HeadphonesIcon },
  { href: "/community", label: "Community", icon: Heart },
  { href: "/careers", label: "Careers", icon: Mail },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface SectionMeta {
  title: string;
  description: string;
}

export const sectionMeta: Record<SectionId, SectionMeta> = {
  crm: {
    title: "CRM",
    description: "Leads, solution requests, and contact form submissions from the main site.",
  },
  projects: {
    title: "Projects",
    description: "Active client projects, milestones, and delivery status.",
  },
  clients: {
    title: "Clients",
    description: "Registered client accounts, companies, and loyalty points.",
  },
  employees: {
    title: "Employees",
    description: "Admin and employee accounts with portal access.",
  },
  innovation: {
    title: "Innovation Pipeline",
    description: "Ideas and inventions submitted through the Innovation Hub.",
  },
  products: {
    title: "Product Orders",
    description: "Orders placed from the products catalog on the main site.",
  },
  finance: {
    title: "Finance",
    description: "Invoices and billing linked to client projects.",
  },
  support: {
    title: "Support",
    description: "Open and resolved support tickets from client portal users.",
  },
  analytics: {
    title: "Analytics",
    description: "Company-wide metrics across users, innovation, and operations.",
  },
  settings: {
    title: "Settings",
    description: "Admin panel configuration and connection to the main site.",
  },
  community: {
    title: "Community",
    description: "Members who joined the TechFlare Solutions community on the main site.",
  },
  careers: {
    title: "Careers",
    description: "Job applications received through the careers page.",
  },
};

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
