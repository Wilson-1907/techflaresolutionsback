import { jwtVerify } from "jose";
import { getJwtSecret } from "./env";

export async function verifyAuthCookie(token: string) {
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret);
    return payload as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}
