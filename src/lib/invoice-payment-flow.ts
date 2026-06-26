import { prisma } from "./db";
import { generateDynamicQrCode, isMpesaQrConfigured } from "./mpesa";
import { getAppUrl } from "./env";
import { markWorkflowDepositPaidByFinanceDoc } from "./workflows";

export function invoiceAccountReference(invoiceNumber: string) {
  return invoiceNumber.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
}

export function invoicePayUrl(invoiceId: string) {
  return `${getAppUrl()}/pay?invoice=${invoiceId}`;
}

export async function generateDepositQrForInvoice(invoiceNumber: string, depositAmount: number) {
  if (!isMpesaQrConfigured() || depositAmount < 1) return null;
  try {
    const qr = await generateDynamicQrCode({
      amount: depositAmount,
      accountReference: invoiceAccountReference(invoiceNumber),
    });
    return qr.qrCodeBase64;
  } catch (err) {
    console.error("[invoice-payment] QR generation failed:", err);
    return null;
  }
}

/** After M-Pesa success: mark invoice paid, receipt, email client, notify HOD. */
export async function completeInvoicePaymentAfterMpesa(
  financeDocumentId: string,
  payment: { amount: number; mpesaReceiptNumber?: string | null }
) {
  const invoice = await prisma.financeDocument.findUnique({
    where: { id: financeDocumentId },
    select: { id: true, docType: true, status: true, number: true },
  });
  if (!invoice || invoice.docType !== "invoice") return;

  if (invoice.status !== "paid") {
    await prisma.financeDocument.update({
      where: { id: financeDocumentId },
      data: {
        status: "paid",
        paidAt: new Date(),
        paymentMethod: `M-Pesa ${payment.mpesaReceiptNumber || ""}`.trim(),
      },
    });
  }

  await markWorkflowDepositPaidByFinanceDoc(financeDocumentId, payment);
}

export async function getDepositAmountForInvoice(invoiceId: string) {
  const invoice = await prisma.financeDocument.findUnique({
    where: { id: invoiceId },
    select: { total: true, docType: true },
  });
  if (!invoice || invoice.docType !== "invoice") return null;

  const workflow = await prisma.serviceWorkflow.findFirst({
    where: { financeDocId: invoiceId },
    select: { financeTotal: true, depositPercent: true, depositPaid: true },
  });

  if (!workflow) return invoice.total;
  if (workflow.depositPaid) return null;

  const pct = workflow.depositPercent ?? 60;
  const base = workflow.financeTotal ?? invoice.total;
  return Math.round(base * (pct / 100));
}
