import { prisma } from "@/lib/db";
import { activateAiSessionFromPayment } from "@/lib/ai-session";
import { completeInvoicePaymentAfterMpesa } from "@/lib/invoice-payment-flow";
import { recordFromMpesaPayment } from "@/lib/finance-ledger";
import type { C2bPayload } from "@/lib/mpesa";

function normalizeRef(ref: string) {
  return ref.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export async function applyC2bConfirmation(payload: C2bPayload) {
  const receipt = payload.TransID?.trim();
  const amount = Number(payload.TransAmount || 0);
  const phone = payload.MSISDN || "";
  const billRef = (payload.BillRefNumber || payload.InvoiceNumber || "").trim();

  if (!receipt || !amount) {
    return { accepted: true, matched: false as const };
  }

  const existing = await prisma.mpesaPayment.findFirst({
    where: { mpesaReceiptNumber: { equals: receipt, mode: "insensitive" } },
  });
  if (existing?.status === "completed") {
    return { accepted: true, matched: true as const, paymentId: existing.id };
  }

  let payment =
    existing ||
    (billRef
      ? await prisma.mpesaPayment.findFirst({
          where: {
            accountReference: { contains: billRef.slice(0, 12), mode: "insensitive" },
            status: { in: ["pending", "manual"] },
          },
          orderBy: { createdAt: "desc" },
        })
      : null);

  if (!payment && billRef) {
    const doc = await prisma.financeDocument.findFirst({
      where: { number: { contains: billRef, mode: "insensitive" } },
    });
    if (doc) {
      payment = await prisma.mpesaPayment.findFirst({
        where: { financeDocumentId: doc.id, status: { in: ["pending", "manual"] } },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  if (payment) {
    const updated = await prisma.mpesaPayment.update({
      where: { id: payment.id },
      data: {
        status: "completed",
        mpesaReceiptNumber: receipt,
        phone: phone || payment.phone,
        amount,
        resultDesc: "C2B Till payment confirmed",
      },
    });
    await finalizeCompletedPayment(updated);
    return { accepted: true, matched: true as const, paymentId: updated.id };
  }

  const created = await prisma.mpesaPayment.create({
    data: {
      phone,
      amount,
      accountReference: billRef ? normalizeRef(billRef).slice(0, 12) : `TILL${Date.now().toString(36).slice(-6).toUpperCase()}`,
      description: "M-Pesa Till payment (C2B)",
      referenceType: "general",
      status: "completed",
      mpesaReceiptNumber: receipt,
      resultDesc: "C2B Till payment",
    },
  });
  await finalizeCompletedPayment(created);
  return { accepted: true, matched: true as const, paymentId: created.id };
}

async function finalizeCompletedPayment(payment: {
  id: string;
  orderId: string | null;
  financeDocumentId: string | null;
  referenceType: string;
  amount: number;
  mpesaReceiptNumber: string | null;
  description?: string | null;
  status: string;
  createdAt: Date;
}) {
  await recordFromMpesaPayment(payment);
  if (payment.orderId) {
    await prisma.productOrder.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "paid", status: "confirmed" },
    });
  }
  if (payment.financeDocumentId) {
    await completeInvoicePaymentAfterMpesa(payment.financeDocumentId, {
      amount: payment.amount,
      mpesaReceiptNumber: payment.mpesaReceiptNumber,
    });
  } else if (payment.referenceType === "ai_session") {
    await activateAiSessionFromPayment(payment.id);
  }
}
