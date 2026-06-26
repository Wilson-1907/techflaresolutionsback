import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminPanelUrl, getFinancePanelUrl, getAppUrl } from "@/lib/env";
import { getEmailConfigStatus, verifyEmailDelivery } from "@/lib/email";
import { buildDatabaseUrl, getDatabaseEnvStatus, isDatabaseConfigured } from "@/lib/database-url";

export async function GET(req: NextRequest) {
  const envStatus = getDatabaseEnvStatus();
  let db = false;
  let dbError: string | undefined;

  try {
    if (!isDatabaseConfigured()) {
      throw new Error(
        "Database not configured. Set DATABASE_URL or DB_user, DB_password, DB_HOST, DB_port, Database_name on Render."
      );
    }
    buildDatabaseUrl();
    envStatus.source =
      envStatus.hasDbUser && envStatus.hasDbPassword && envStatus.hasDbHost
        ? "split"
        : envStatus.hasDatabaseUrl
          ? "DATABASE_URL"
          : "missing";
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (error) {
    db = false;
    dbError = error instanceof Error ? error.message : "Database connection failed";
  }

  const smtpVerify =
    req.nextUrl.searchParams.get("smtpVerify") === "1" ? await verifyEmailDelivery() : undefined;

  return NextResponse.json({
    status: "ok",
    app: "techflare-unified-backend",
    db,
    dbError: db ? undefined : dbError,
    dbConfig: {
      source: envStatus.source,
      vars: {
        Database_name: envStatus.hasDatabaseName,
        DATABASE_URL: envStatus.hasDatabaseUrl,
        DB_HOST: envStatus.hasDbHost,
        DB_user: envStatus.hasDbUser,
        DB_password: envStatus.hasDbPassword,
        DB_port: envStatus.hasDbPort,
      },
    },
    urls: {
      main: getAppUrl(),
      admin: getAdminPanelUrl(),
      finance: getFinancePanelUrl(),
    },
    email: getEmailConfigStatus(),
    smtpVerify,
  });
}
