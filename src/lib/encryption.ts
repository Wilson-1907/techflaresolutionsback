import crypto from "crypto";

const PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer | null {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      const jwt = process.env.JWT_SECRET?.trim();
      if (jwt) {
        return crypto.scryptSync(jwt, "techflare-enc-salt", 32);
      }
      throw new Error("ENCRYPTION_KEY or JWT_SECRET is required in production for data encryption");
    }
    return crypto.scryptSync("techflare-dev-key", "salt", 32);
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    const jwt = process.env.JWT_SECRET?.trim();
    if (jwt) {
      return crypto.scryptSync(jwt, "techflare-enc-salt", 32);
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
    }
    return crypto.scryptSync("techflare-dev-key", "salt", 32);
  }
  return key;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptField(value: string | null | undefined): string | null | undefined {
  if (value == null || value === "") return value;
  if (isEncrypted(value)) return value;

  const key = getKey();
  if (!key) return value;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptField(value: string | null | undefined): string | null | undefined {
  if (value == null || value === "") return value;
  if (!isEncrypted(value)) return value;

  const key = getKey();
  if (!key) return value;

  try {
    const payload = value.slice(PREFIX.length);
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return value;

    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return value;
  }
}

export function hashForLookup(value: string): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "techflare-lookup";
  return crypto.createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}
