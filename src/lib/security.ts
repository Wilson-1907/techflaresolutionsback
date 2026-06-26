import { NextRequest, NextResponse } from "next/server";
import { getAllowedOrigins } from "./env";

const buckets = new Map<string, { count: number; resetAt: number }>();

const SCRAPER_AGENTS = [
  "scrapy",
  "curl/",
  "wget/",
  "python-requests",
  "python-urllib",
  "aiohttp",
  "httpclient",
  "libwww",
  "httrack",
  "ia_archiver",
  "semrush",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "bytespider",
  "gptbot",
  "claudebot",
  "anthropic",
  "ccbot",
  "dataforseo",
  "serpstat",
  "panscient",
  "extractor",
  "headlesschrome",
  "phantomjs",
  "selenium",
  "puppeteer",
  "playwright",
  "webzip",
  "sitesucker",
  "webcopier",
  "teleport",
  "offline explorer",
  "go-http-client",
  "java/",
  "apache-httpclient",
  "okhttp",
  "node-fetch",
  "undici",
];

export function rateLimit(
  req: NextRequest,
  limit = 60,
  windowMs = 60_000
): NextResponse | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const key = `${ip}:${new URL(req.url).pathname}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count += 1;
  if (entry.count > limit) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  return null;
}

export function isBotOrScraper(req: NextRequest): boolean {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (!ua || ua.length < 12) return true;
  if (SCRAPER_AGENTS.some((b) => ua.includes(b))) return true;

  const suspiciousHeaders =
    !req.headers.get("accept-language") &&
    !req.headers.get("sec-fetch-site") &&
    !req.headers.get("sec-fetch-mode");

  if (suspiciousHeaders && req.method === "GET" && !ua.includes("mozilla")) {
    return true;
  }

  return false;
}

export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins();

  try {
    const originHost = new URL(origin).host;
    const host = req.headers.get("host");
    if (host && originHost === host) return true;
    return allowedOrigins.some((allowed) => {
      try {
        return new URL(allowed).host === originHost;
      } catch {
        return allowed === origin;
      }
    });
  } catch {
    return false;
  }
}

export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), display-capture=()");
  response.headers.set("X-Robots-Tag", "noai, noimageai, noarchive, nosnippet");
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self' mailto:"
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}
