/**
 * Resolves PostgreSQL connection from Render/Aiven env vars.
 *
 * Supported names (use exactly as on Render):
 *   Database_name, DATABASE_URL, DB_HOST, DB_password, DB_port, DB_user
 *
 * If DB_user + DB_password + DB_HOST are set, builds DATABASE_URL from them.
 * Otherwise falls back to DATABASE_URL.
 */

export type DatabaseEnvStatus = {
  source: "split" | "DATABASE_URL" | "missing";
  hasDatabaseName: boolean;
  hasDatabaseUrl: boolean;
  hasDbHost: boolean;
  hasDbUser: boolean;
  hasDbPassword: boolean;
  hasDbPort: boolean;
};

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Defaults aligned with Render/Aiven variable names */
const DEFAULTS = {
  Database_name: "defaultdb",
  DB_port: "16638",
  DB_user: "avnadmin",
} as const;

const BUILD_PLACEHOLDER_URL =
  "postgresql://build:build@127.0.0.1:5432/defaultdb?sslmode=require";

export function isDatabaseConfigured(): boolean {
  const password = read("DB_password");
  const host = read("DB_HOST");
  if (password && host) return true;
  return Boolean(read("DATABASE_URL"));
}

export function getDatabaseEnvStatus(): DatabaseEnvStatus {
  const hasDbUser = Boolean(read("DB_user") || DEFAULTS.DB_user);
  const hasDbPassword = Boolean(read("DB_password"));
  const hasDbHost = Boolean(read("DB_HOST"));
  const hasDatabaseName = Boolean(read("Database_name") || DEFAULTS.Database_name);
  const hasDbPort = Boolean(read("DB_port") || DEFAULTS.DB_port);
  const hasDatabaseUrl = Boolean(read("DATABASE_URL"));

  return {
    source: "missing",
    hasDatabaseName,
    hasDatabaseUrl,
    hasDbHost,
    hasDbUser,
    hasDbPassword,
    hasDbPort,
  };
}

function encodePart(value: string): string {
  return encodeURIComponent(value);
}

export function buildDatabaseUrl(): string {
  const user = read("DB_user") || DEFAULTS.DB_user;
  const password = read("DB_password");
  const host = read("DB_HOST");
  const port = read("DB_port") || DEFAULTS.DB_port;
  const database = read("Database_name") || DEFAULTS.Database_name;

  if (password && host) {
    return `postgresql://${encodePart(user)}:${encodePart(password)}@${host}:${port}/${encodePart(database)}?sslmode=require`;
  }

  const databaseUrl = read("DATABASE_URL");
  if (databaseUrl) {
    return databaseUrl;
  }

  // Next.js Docker build has no runtime env — placeholder only, not used for queries
  return BUILD_PLACEHOLDER_URL;
}

export function ensureDatabaseUrl(): string {
  const url = buildDatabaseUrl();
  if (isDatabaseConfigured()) {
    process.env.DATABASE_URL = url;
  } else if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url;
  }
  return process.env.DATABASE_URL;
}
