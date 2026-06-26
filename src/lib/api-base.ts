/**
 * API base URL for split deployment.
 * Leave empty in local monolith dev to use same-origin /api routes on the main site.
 */
export function getApiBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    "";
  return url.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}
