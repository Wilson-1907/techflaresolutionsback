import { cookies } from "next/headers";
import crypto from "crypto";
import { getAdminPanelSecret, isProduction } from "@/lib/env";

const COOKIE_NAME = "tf_admin_session";

function sign(value: string) {
  return crypto.createHmac("sha256", getAdminPanelSecret()).update(value).digest("hex");
}

export function verifySessionValue(raw: string | undefined): boolean {
  if (!raw) return false;
  const [token, signature] = raw.split(".");
  if (!token || !signature) return false;
  return sign(token) === signature;
}

export async function createSession() {
  const token = crypto.randomBytes(24).toString("hex");
  const signature = sign(token);
  const store = await cookies();
  store.set(COOKIE_NAME, `${token}.${signature}`, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(COOKIE_NAME)?.value);
}
