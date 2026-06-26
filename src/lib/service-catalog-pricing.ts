import { prisma } from "./db";
import type { CatalogService } from "@/data/service-catalog";
import { SERVICE_CATALOG } from "@/data/service-catalog";

const BUSY_STATUSES = [
  "ASSIGNED_TO_DEPT",
  "HOD_BUDGET_SUBMITTED",
  "FINANCE_REVIEW",
  "SENT_TO_CLIENT",
  "DEPOSIT_PAID",
  "WORK_STARTED",
  "IN_PROGRESS",
] as const;

/** Seasonal factor — Kenya business calendar (lighter Jan, busier Sep–Nov). */
function seasonalFactor(date = new Date()): number {
  const month = date.getMonth(); // 0–11
  const seasonal: Record<number, number> = {
    0: 0.92,
    1: 0.94,
    2: 0.96,
    3: 0.98,
    4: 1.0,
    5: 1.02,
    6: 1.0,
    7: 1.04,
    8: 1.08,
    9: 1.12,
    10: 1.1,
    11: 0.98,
  };
  return seasonal[month] ?? 1;
}

async function activeProjectLoad(): Promise<number> {
  return prisma.serviceWorkflow.count({
    where: { status: { in: [...BUSY_STATUSES] } },
  });
}

/**
 * Demand multiplier: rises when many active projects (busy season), drops when queue is light.
 * Range roughly 0.88 – 1.22 combined with seasonal factor.
 */
export async function getDemandMultiplier(): Promise<{
  multiplier: number;
  activeProjects: number;
  seasonal: number;
  loadFactor: number;
  label: string;
}> {
  const activeProjects = await activeProjectLoad();
  const seasonal = seasonalFactor();

  let loadFactor = 1;
  if (activeProjects <= 2) loadFactor = 0.92;
  else if (activeProjects <= 5) loadFactor = 0.97;
  else if (activeProjects <= 10) loadFactor = 1.05;
  else if (activeProjects <= 18) loadFactor = 1.12;
  else loadFactor = 1.18;

  const raw = seasonal * loadFactor;
  const multiplier = Math.round(raw * 100) / 100;

  const label =
    multiplier >= 1.1
      ? "High demand — prices adjusted up"
      : multiplier <= 0.95
        ? "Low season — preferential rates"
        : "Standard rates";

  return { multiplier, activeProjects, seasonal, loadFactor, label };
}

export function applyDemandPrice(basePriceKes: number, multiplier: number): number {
  return Math.round((basePriceKes * multiplier) / 100) * 100;
}

export async function getPricedCatalog(): Promise<{
  services: Array<CatalogService & { currentPriceKes: number; demandNote: string }>;
  demand: Awaited<ReturnType<typeof getDemandMultiplier>>;
}> {
  const demand = await getDemandMultiplier();
  const services = SERVICE_CATALOG.map((s) => ({
    ...s,
    currentPriceKes: applyDemandPrice(s.basePriceKes, demand.multiplier),
    demandNote: demand.label,
  }));
  return { services, demand };
}
