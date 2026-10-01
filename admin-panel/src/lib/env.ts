export function getMainSiteUrl(): string {
  const url = process.env.MAIN_SITE_URL?.trim() || process.env.NEXT_PUBLIC_MAIN_SITE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("MAIN_SITE_URL is required in production.");
  }
  return "http://localhost:3000";
}

export function getAdminPanelSecret(): string {
  const secret = process.env.ADMIN_PANEL_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PANEL_SECRET is required in production.");
  }
  return "dev-panel-secret";
}

export function getAdminPanelPassword(): string {
  const password = process.env.ADMIN_PANEL_PASSWORD?.trim();
  if (password) return password;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PANEL_PASSWORD is required in production.");
  }
  return "admin123";
}

export function getAdminApiKey(): string {
  const key = process.env.ADMIN_API_KEY?.trim();
  if (key) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_API_KEY is required in production.");
  }
  return "dev-admin-api-key";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
