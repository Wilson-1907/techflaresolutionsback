const isProd = process.env.NODE_ENV === "production";
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

function normalizeEnvValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function requireEnv(name: string, devFallback?: string): string {
  const raw = process.env[name];
  const value = raw ? normalizeEnvValue(raw) : "";
  if (value) return value;
  if (isBuild) return devFallback || `build-placeholder-${name}`;
  if (isProd) {
    throw new Error(`${name} is required in production. Set it in your environment.`);
  }
  if (devFallback !== undefined) return devFallback;
  throw new Error(`${name} is required. Copy .env.example to .env and configure it.`);
}

export function getJwtSecret(): string {
  return requireEnv("JWT_SECRET", "dev-secret-change-in-production");
}

export function getAdminApiKey(): string {
  return requireEnv("ADMIN_API_KEY", "dev-admin-api-key");
}

export function getFinanceApiKey(): string {
  return requireEnv("FINANCE_API_KEY", "dev-finance-api-key");
}

export function getAdminPanelUrl(): string {
  const direct = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL?.trim();
  if (direct) return direct.replace(/\/$/, "");
  const cors = process.env.CORS_ORIGINS?.split(",")
    .map((o) => o.trim())
    .find((o) => o.includes("admin"));
  if (cors) return cors.replace(/\/$/, "");
  if (isBuild) return "http://localhost:3001";
  if (!isProd) return "http://localhost:3001";
  return "https://techflaresolutionsadmin-7dyu.vercel.app";
}

export function getFinancePanelUrl(): string {
  const direct = process.env.NEXT_PUBLIC_FINANCE_PANEL_URL?.trim();
  if (direct) return direct.replace(/\/$/, "");
  const cors = process.env.CORS_ORIGINS?.split(",")
    .map((o) => o.trim())
    .find((o) => o.includes("finance"));
  if (cors) return cors.replace(/\/$/, "");
  if (isBuild) return "http://localhost:3002";
  if (!isProd) return "http://localhost:3002";
  return "https://techflaresolutionsfinance.vercel.app";
}

export function getAppUrl(): string {
  const direct = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (direct) return direct.replace(/\/$/, "");

  const corsFirst = process.env.CORS_ORIGINS?.split(",")[0]?.trim();
  if (corsFirst) return corsFirst.replace(/\/$/, "");

  if (isBuild) return "http://localhost:3000";
  if (!isProd) return "http://localhost:3000";

  // Production fallback — avoids breaking auth emails when only CORS_ORIGINS is set
  return "https://techflaresolutionss.vercel.app";
}

export function isProduction(): boolean {
  return isProd;
}

/** Origins allowed for CORS and auth (register/login) checks. */
export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const fromUrls = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_ADMIN_PANEL_URL,
    process.env.NEXT_PUBLIC_FINANCE_PANEL_URL,
  ]
    .map((o) => o?.trim().replace(/\/$/, ""))
    .filter(Boolean) as string[];

  const localhost =
    isProd && !isBuild
      ? []
      : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];

  const expanded = new Set<string>([...fromEnv, ...fromUrls, ...localhost]);

  for (const url of [...expanded]) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      if (host.startsWith("www.")) {
        expanded.add(`${u.protocol}//${host.slice(4)}`);
      } else {
        expanded.add(`${u.protocol}//www.${host}`);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return [...expanded];
}
