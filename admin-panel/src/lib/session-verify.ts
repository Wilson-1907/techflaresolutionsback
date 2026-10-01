function getSecret(): string {
  const secret = process.env.ADMIN_PANEL_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") return "";
  return "dev-panel-secret";
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifySessionCookie(raw: string | undefined): Promise<boolean> {
  if (!raw) return false;
  const [token, signature] = raw.split(".");
  if (!token || !signature) return false;

  const secret = getSecret();
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  return bufferToHex(signed) === signature;
}
