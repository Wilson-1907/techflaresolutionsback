import { decryptField, encryptField, hashForLookup, isEncrypted } from "./encryption";

/** Prisma model name → string fields encrypted at rest */
export const ENCRYPTED_MODEL_FIELDS: Record<string, string[]> = {
  User: ["phone", "mfaSecret", "communityEmail"],
  Idea: ["description", "attachments", "reviewNotes"],
  SolutionRequest: ["problem", "proposal", "guestName", "guestEmail", "budget", "timeline"],
  ContactSubmission: ["name", "email", "phone", "message"],
  CareerApplication: ["applicantName", "applicantEmail", "applicantPhone", "coverLetter"],
  ProductOrder: ["customerName", "customerPhone", "organization", "message"],
  SupportTicket: ["message"],
  MpesaPayment: ["phone", "description"],
  Message: ["content"],
  FinanceDocument: ["clientName", "clientEmail", "clientPhone", "notes"],
};

function fieldsFor(model: string): string[] {
  return ENCRYPTED_MODEL_FIELDS[model] ?? [];
}

function encryptRecord(model: string, record: Record<string, unknown>): Record<string, unknown> {
  if (!record || typeof record !== "object") return record;

  const out = { ...record };

  if (model === "User" && typeof out.phone === "string" && out.phone && !isEncrypted(out.phone)) {
    out.phoneHash = hashForLookup(out.phone);
  }

  for (const field of fieldsFor(model)) {
    const val = out[field];
    if (typeof val === "string") {
      out[field] = encryptField(val);
    }
  }

  return out;
}

function decryptRecord<T>(model: string, record: T): T {
  if (!record || typeof record !== "object") return record;

  const out = { ...record } as Record<string, unknown>;
  for (const field of fieldsFor(model)) {
    const val = out[field];
    if (typeof val === "string") {
      out[field] = decryptField(val);
    }
  }

  return out as T;
}

export function encryptWriteData(model: string, data: unknown): unknown {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map((row) => encryptRecord(model, row as Record<string, unknown>));
  }
  if (typeof data === "object") {
    return encryptRecord(model, data as Record<string, unknown>);
  }
  return data;
}

export function decryptReadData<T>(model: string, data: T): T {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map((row) => decryptRecord(model, row)) as T;
  }
  return decryptRecord(model, data as Record<string, unknown>) as T;
}
