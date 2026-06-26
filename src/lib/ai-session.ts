import { prisma } from "./db";
import { allocateFinanceDocumentNumber } from "./finance-number";

export const AI_SESSION_PRICE_KES = 100;
export const AI_SESSION_HOURS = 12;
export const AI_SESSION_PURPOSE = "ai_self_service";

export function aiSessionExpiryFromNow(from = new Date()) {
  return new Date(from.getTime() + AI_SESSION_HOURS * 60 * 60 * 1000);
}

export async function getActiveAiSession(userId: string) {
  const session = await prisma.aiSession.findFirst({
    where: {
      userId,
      purpose: AI_SESSION_PURPOSE,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
  });
  return session;
}

export async function requireActiveAiSession(userId: string) {
  const session = await getActiveAiSession(userId);
  if (!session) {
    return null;
  }
  return session;
}

export async function activateAiSessionFromPayment(paymentId: string) {
  const payment = await prisma.mpesaPayment.findUnique({
    where: { id: paymentId },
    include: { aiSession: true },
  });

  if (!payment || payment.referenceType !== "ai_session") {
    return null;
  }
  if (!payment.userId) {
    return null;
  }
  if (payment.status !== "completed") {
    return null;
  }
  if (payment.aiSession) {
    return payment.aiSession;
  }

  const user = await prisma.user.findUnique({ where: { id: payment.userId } });
  if (!user) return null;

  const expiresAt = aiSessionExpiryFromNow();
  const receiptNumber = await allocateFinanceDocumentNumber(prisma, "receipt");
  const aiRef = receiptNumber.replace("TFS/RCP/", "TFS/AI/");

  const receipt = await prisma.financeDocument.create({
    data: {
      docType: "receipt",
      number: receiptNumber,
      status: "paid",
      currency: "KES",
      subtotal: payment.amount,
      taxRate: 0,
      taxAmount: 0,
      total: payment.amount,
      lineItems: [
        {
          description: "AI Self-Service Session (12 hours) — fine-tune ideas & AI proposals",
          qty: 1,
          unitPrice: payment.amount,
        },
      ],
      clientName: `${user.firstName} ${user.lastName}`.trim(),
      clientEmail: user.email,
      clientPhone: payment.phone,
      clientRole: user.role,
      invoiceRef: aiRef,
      paymentMethod: payment.mpesaReceiptNumber
        ? `M-Pesa ${payment.mpesaReceiptNumber}`
        : "M-Pesa Till 9356451",
      notes: `AI session payment · Ref ${payment.accountReference}`,
      showOnMainSite: false,
      paidAt: new Date(),
      docDate: new Date(),
    },
  });

  await prisma.mpesaPayment.update({
    where: { id: payment.id },
    data: { financeDocumentId: receipt.id },
  });

  const session = await prisma.aiSession.create({
    data: {
      userId: payment.userId,
      purpose: AI_SESSION_PURPOSE,
      expiresAt,
      paymentId: payment.id,
      financeDocId: receipt.id,
    },
  });

  return session;
}

export function aiSessionStatus(session: { expiresAt: Date } | null) {
  if (!session) {
    return {
      active: false,
      priceKes: AI_SESSION_PRICE_KES,
      durationHours: AI_SESSION_HOURS,
      expiresAt: null as string | null,
      remainingMs: 0,
    };
  }
  const remainingMs = Math.max(0, session.expiresAt.getTime() - Date.now());
  return {
    active: remainingMs > 0,
    priceKes: AI_SESSION_PRICE_KES,
    durationHours: AI_SESSION_HOURS,
    expiresAt: session.expiresAt.toISOString(),
    remainingMs,
  };
}
