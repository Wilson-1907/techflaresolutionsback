import { NextRequest, NextResponse } from "next/server";
import { rateLimit, isBotOrScraper, applySecurityHeaders } from "@/lib/security";
import { isTrustedAdminRequest } from "@/lib/admin-api";
import { isTrustedFinanceRequest } from "@/lib/finance-api";
import { getAllowedOrigins } from "@/lib/env";

function corsHeaders(req: NextRequest) {
  const allowed = getAllowedOrigins();
  const origin = req.headers.get("origin") || "";
  const allowOrigin =
    allowed.some((entry) => {
      try {
        return new URL(entry).origin === origin;
      } catch {
        return entry === origin;
      }
    })
      ? origin
      : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Api-Key, X-Finance-Api-Key",
    "Access-Control-Allow-Credentials": "true",
  };
}

function isTrustedServiceRequest(req: NextRequest) {
  return isTrustedAdminRequest(req) || isTrustedFinanceRequest(req);
}

/** Public read APIs used by the main site SSR and client — must not block server fetches. */
function isPublicContentRead(req: NextRequest): boolean {
  if (req.method !== "GET") return false;
  const path = req.nextUrl.pathname;
  return (
    path === "/api/health" ||
    path === "/api/jobs" ||
    path === "/api/catalog" ||
    path === "/api/stats" ||
    path.startsWith("/api/news") ||
    path.startsWith("/api/blogs") ||
    path.startsWith("/api/announcements") ||
    path.startsWith("/api/testimonials")
  );
}

/** Public payment reads for pay page and status polling. */
function isPublicPaymentRead(req: NextRequest): boolean {
  if (req.method !== "GET") return false;
  const path = req.nextUrl.pathname;
  return (
    path === "/api/payments/mpesa/till" ||
    path.startsWith("/api/payments/invoice/") ||
    /^\/api\/payments\/mpesa\/[^/]+$/.test(path)
  );
}

/** Safaricom Daraja webhooks — no browser origin; must not be blocked. */
function isMpesaWebhook(path: string): boolean {
  return path.startsWith("/api/payments/mpesa/callback") || path.startsWith("/api/payments/mpesa/c2b/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const trustedService = isTrustedServiceRequest(req);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
  }

  if (pathname === "/api/health" || isMpesaWebhook(pathname)) {
    const res = applySecurityHeaders(NextResponse.next());
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  if (pathname.startsWith("/api") && !trustedService) {
    const origin = req.headers.get("origin") || "";
    const allowedOrigins = getAllowedOrigins();
    const trustedOrigin = allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === origin;
      } catch {
        return allowed === origin;
      }
    });

    if (!isPublicContentRead(req) && !isPublicPaymentRead(req) && !trustedOrigin && isBotOrScraper(req)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const limited = rateLimit(req, 120, 60_000);
    if (limited) return limited;
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  Object.entries(corsHeaders(req)).forEach(([k, v]) => response.headers.set(k, v));

  if (pathname.startsWith("/api")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
