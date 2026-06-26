import { SERVICE_CATALOG } from "@/data/service-catalog";

export type PublicCatalogService = Omit<
  (typeof SERVICE_CATALOG)[number],
  "basePriceKes" | "tags"
>;

/** Public-facing catalog — no prices (quotes are per project). */
export function getPublicCatalog(): { services: PublicCatalogService[] } {
  return {
    services: SERVICE_CATALOG.map(({ basePriceKes: _base, tags: _tags, ...rest }) => rest),
  };
}
