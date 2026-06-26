export const MPESA_TILL_NUMBER = process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE || "9356451";
export const MPESA_TILL_NAME = process.env.MPESA_TILL_NAME || "TechFlare Solutions";

type MpesaConfig = {
  consumerKey?: string;
  consumerSecret?: string;
  passkey?: string;
  shortcode: string;
  tillNumber: string;
  callbackUrl?: string;
  c2bConfirmationUrl?: string;
  c2bValidationUrl?: string;
  baseUrl: string;
};

export function getMpesaConfig(): MpesaConfig {
  const backendBase = process.env.MPESA_PUBLIC_BASE_URL || process.env.BACKEND_PUBLIC_URL || "";
  const defaultCallback = backendBase
    ? `${backendBase.replace(/\/$/, "")}/api/payments/mpesa/callback`
    : undefined;

  return {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    passkey: process.env.MPESA_PASSKEY,
    shortcode: process.env.MPESA_SHORTCODE || MPESA_TILL_NUMBER,
    tillNumber: MPESA_TILL_NUMBER,
    callbackUrl: process.env.MPESA_CALLBACK_URL || defaultCallback,
    c2bConfirmationUrl:
      process.env.MPESA_C2B_CONFIRMATION_URL ||
      (backendBase ? `${backendBase.replace(/\/$/, "")}/api/payments/mpesa/c2b/confirmation` : undefined),
    c2bValidationUrl:
      process.env.MPESA_C2B_VALIDATION_URL ||
      (backendBase ? `${backendBase.replace(/\/$/, "")}/api/payments/mpesa/c2b/validation` : undefined),
    baseUrl: "https://api.safaricom.co.ke",
  };
}

export function getMpesaStatus() {
  const config = getMpesaConfig();
  return {
    tillNumber: config.tillNumber,
    tillName: MPESA_TILL_NAME,
    environment: "production" as const,
    stkEnabled: isMpesaConfigured(),
    qrEnabled: isMpesaQrConfigured(),
    shortcode: config.shortcode,
    callbackUrl: config.callbackUrl || null,
    c2bConfirmationUrl: config.c2bConfirmationUrl || null,
    c2bValidationUrl: config.c2bValidationUrl || null,
    missing: [
      !config.consumerKey && "MPESA_CONSUMER_KEY",
      !config.consumerSecret && "MPESA_CONSUMER_SECRET",
      !config.passkey && "MPESA_PASSKEY",
      !config.callbackUrl && "MPESA_CALLBACK_URL",
    ].filter(Boolean) as string[],
  };
}

export function isMpesaConfigured(): boolean {
  const c = getMpesaConfig();
  return !!(c.consumerKey && c.consumerSecret && c.passkey && c.callbackUrl);
}

export function isMpesaQrConfigured(): boolean {
  const c = getMpesaConfig();
  return !!(c.consumerKey && c.consumerSecret);
}

export function normalizeKenyanPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `254${digits.slice(1)}`;
  else if (digits.startsWith("7") || digits.startsWith("1")) digits = `254${digits}`;
  if (!digits.startsWith("254") || digits.length < 12) {
    throw new Error("Enter a valid Kenyan M-Pesa number (e.g. 07XX XXX XXX)");
  }
  return digits;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function password(shortcode: string, passkey: string, ts: string): string {
  return Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");
}

async function getAccessToken(config: MpesaConfig): Promise<string> {
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const res = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = (await res.json()) as { access_token?: string; errorMessage?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.errorMessage || "M-Pesa authentication failed");
  }
  return data.access_token;
}

export async function initiateStkPush(params: {
  phone: string;
  amount: number;
  accountReference: string;
  description: string;
}) {
  const config = getMpesaConfig();
  if (!isMpesaConfigured()) {
    throw new Error("M-Pesa API is not configured. Pay manually to Till " + config.tillNumber);
  }

  const phone = normalizeKenyanPhone(params.phone);
  const amount = Math.round(params.amount);
  if (amount < 1) throw new Error("Minimum payment is KES 1");

  const ts = timestamp();
  const till = config.shortcode;
  const token = await getAccessToken(config);

  const body = {
    BusinessShortCode: till,
    Password: password(till, config.passkey!, ts),
    Timestamp: ts,
    TransactionType: "CustomerBuyGoodsOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: till,
    PhoneNumber: phone,
    CallBackURL: config.callbackUrl,
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: params.description.slice(0, 13),
  };

  const res = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
    errorMessage?: string;
  };

  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(data.errorMessage || data.ResponseDescription || "STK Push failed");
  }

  return {
    checkoutRequestId: data.CheckoutRequestID!,
    merchantRequestId: data.MerchantRequestID!,
    customerMessage: data.ResponseDescription || "Check your phone to complete payment",
  };
}

export async function generateDynamicQrCode(params: {
  amount: number;
  accountReference: string;
  merchantName?: string;
}) {
  const config = getMpesaConfig();
  if (!isMpesaQrConfigured()) {
    throw new Error("M-Pesa QR is not configured");
  }

  const amount = Math.round(params.amount);
  if (amount < 1) throw new Error("Minimum payment is KES 1");

  const token = await getAccessToken(config);
  const res = await fetch(`${config.baseUrl}/mpesa/qrcode/v1/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      MerchantName: (params.merchantName || MPESA_TILL_NAME).slice(0, 25),
      RefNo: params.accountReference.slice(0, 12),
      Amount: amount,
      TrxCode: "BG",
      CPI: config.tillNumber,
      Size: "300",
    }),
  });

  const data = (await res.json()) as {
    QRCode?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
    errorMessage?: string;
  };

  if (!res.ok || data.ResponseCode !== "0" || !data.QRCode) {
    throw new Error(data.errorMessage || data.ResponseDescription || "QR code generation failed");
  }

  return {
    qrCodeBase64: data.QRCode,
    message: data.ResponseDescription || "Scan with the M-Pesa or My Safaricom app",
  };
}

export function parseStkCallback(payload: unknown) {
  const body = payload as {
    Body?: {
      stkCallback?: {
        MerchantRequestID?: string;
        CheckoutRequestID?: string;
        ResultCode?: number;
        ResultDesc?: string;
        CallbackMetadata?: {
          Item?: Array<{ Name?: string; Value?: string | number }>;
        };
      };
    };
  };

  const cb = body?.Body?.stkCallback;
  if (!cb) return null;

  const meta: Record<string, string> = {};
  for (const item of cb.CallbackMetadata?.Item || []) {
    if (item.Name && item.Value !== undefined) meta[item.Name] = String(item.Value);
  }

  return {
    merchantRequestId: cb.MerchantRequestID,
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode ?? -1,
    resultDesc: cb.ResultDesc || "",
    mpesaReceiptNumber: meta.MpesaReceiptNumber,
    amount: meta.Amount ? Number(meta.Amount) : undefined,
    phone: meta.PhoneNumber,
  };
}

export type C2bPayload = {
  TransactionType?: string;
  TransID?: string;
  TransTime?: string;
  TransAmount?: string | number;
  BusinessShortCode?: string;
  BillRefNumber?: string;
  InvoiceNumber?: string;
  MSISDN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
};

export function parseC2bPayload(payload: unknown): C2bPayload | null {
  if (!payload || typeof payload !== "object") return null;
  return payload as C2bPayload;
}

/** Register validation + confirmation URLs with Daraja (run once after Go Live). */
export async function registerC2BUrls() {
  const config = getMpesaConfig();
  if (!isMpesaConfigured()) {
    throw new Error("M-Pesa API credentials are not configured");
  }
  if (!config.c2bConfirmationUrl || !config.c2bValidationUrl) {
    throw new Error("Set MPESA_C2B_CONFIRMATION_URL and MPESA_C2B_VALIDATION_URL (or MPESA_PUBLIC_BASE_URL)");
  }

  const token = await getAccessToken(config);
  const res = await fetch(`${config.baseUrl}/mpesa/c2b/v1/registerurl`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ShortCode: config.shortcode,
      ResponseType: "Completed",
      ConfirmationURL: config.c2bConfirmationUrl,
      ValidationURL: config.c2bValidationUrl,
    }),
  });

  const data = (await res.json()) as { ResponseDescription?: string; errorMessage?: string };
  if (!res.ok) {
    throw new Error(data.errorMessage || data.ResponseDescription || "C2B URL registration failed");
  }
  return data;
}
