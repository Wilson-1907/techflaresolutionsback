export const COMPANY_OFFICES = [
  { slug: "karatina", city: "Karatina", label: "Karatina Office" },
  { slug: "nyeri", city: "Nyeri", label: "Nyeri Office" },
  { slug: "remote", city: "Remote", label: "Remote / Online" },
] as const;

export type CompanyOfficeSlug = (typeof COMPANY_OFFICES)[number]["slug"];

export function officeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return COMPANY_OFFICES.find((o) => o.slug === slug)?.label ?? slug;
}
