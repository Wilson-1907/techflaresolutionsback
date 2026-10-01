import { getAdminApiKey, getMainSiteUrl as getBaseUrl } from "@/lib/env";

export class MainSiteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function mainSiteFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("X-Admin-Api-Key", getAdminApiKey());
  headers.set("User-Agent", "TechFlare-Solutions-AdminPanel/1.0");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new MainSiteError(data.error || "Main site request failed", res.status);
  }

  return data;
}

export function getMainSiteUrl() {
  return getBaseUrl();
}
