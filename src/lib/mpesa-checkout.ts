import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { AI_SESSION_PRICE_KES, AI_SESSION_PURPOSE } from "@/lib/ai-session";

export type MpesaReferenceType = "order" | "invoice" | "general" | "ai_session";

export type MpesaCheckoutInput = {
  amount: number;
  referenceType: MpesaReferenceType;
  referenceId?: string;
  description?: string;
  phone?: string;
};

export type MpesaCheckoutContext = {
  accountReference: string;
  orderId?: string;
  financeDocumentId?: string;
  description: string;
  referenceId?: string;
  userId?: string;
};

export async function resolveMpesaCheckout(
  body: MpesaCheckoutInput,
  req?: Request
): Promise<{ ok: true; ctx: MpesaCheckoutContext } | { ok: false; status: number; error: string }> {
  const session = req ? await getSessionFromRequest(req) : null;

  let accountReference = `TF${Date.now().toString(36).slice(-8)}`;
  let orderId: string | undefined;
  let financeDocumentId: string | undefined;
  let description = body.description || "TechFlare Solutions payment";
  let referenceId = body.referenceId;

  if (body.referenceType === "order" && body.referenceId) {
    const order = await prisma.productOrder.findUnique({ where: { id: body.referenceId } });
    if (!order) return { ok: false, status: 404, error: "Order not found" };
    accountReference = `ORD${order.id.slice(-8)}`;
    orderId = order.id;
    description = `Order ${order.productTitle}`;
    await prisma.productOrder.update({
      where: { id: order.id },
      data: { amountKes: body.amount, paymentStatus: "pending" },
    });
  }

  if (body.referenceType === "invoice" && body.referenceId) {
    const doc = await prisma.financeDocument.findUnique({ where: { id: body.referenceId } });
    if (!doc) return { ok: false, status: 404, error: "Invoice not found" };
    if (doc.status === "paid") {
      return { ok: false, status: 400, error: "Invoice already paid" };
    }
    const linkedWorkflow = await prisma.serviceWorkflow.findFirst({
      where: { financeDocId: doc.id },
      select: { clientAgreed: true, status: true },
    });
    if (linkedWorkflow && !linkedWorkflow.clientAgreed && linkedWorkflow.status === "SENT_TO_CLIENT") {
      return {
        ok: false,
        status: 400,
        error: "Please agree to the proposal in your portal before paying.",
      };
    }
    accountReference = doc.number.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
    financeDocumentId = doc.id;
    description = `${doc.docType} ${doc.number}`;
  }

  if (body.referenceType === "ai_session") {
    if (!session) return { ok: false, status: 401, error: "Sign in required" };
    if (body.amount !== AI_SESSION_PRICE_KES) {
      return { ok: false, status: 400, error: `AI session costs KES ${AI_SESSION_PRICE_KES}` };
    }
    accountReference = `AI${Date.now().toString(36).slice(-8).toUpperCase()}`;
    description = body.description || "TechFlare AI Self-Service Session (12 hours)";
    referenceId = referenceId || AI_SESSION_PURPOSE;
  }

  return {
    ok: true,
    ctx: {
      accountReference,
      orderId,
      financeDocumentId,
      description,
      referenceId,
      userId: session?.id,
    },
  };
}

export async function createMpesaPaymentRecord(
  body: MpesaCheckoutInput,
  ctx: MpesaCheckoutContext,
  data: {
    status: "pending" | "manual";
    checkoutRequestId?: string;
    merchantRequestId?: string;
    resultDesc?: string;
  }
) {
  return prisma.mpesaPayment.create({
    data: {
      phone: body.phone || "",
      amount: body.amount,
      accountReference: ctx.accountReference,
      description: ctx.description,
      referenceType: body.referenceType,
      referenceId: ctx.referenceId,
      checkoutRequestId: data.checkoutRequestId,
      merchantRequestId: data.merchantRequestId,
      orderId: ctx.orderId,
      financeDocumentId: ctx.financeDocumentId,
      userId: ctx.userId,
      status: data.status,
      resultDesc: data.resultDesc,
    },
  });
}
