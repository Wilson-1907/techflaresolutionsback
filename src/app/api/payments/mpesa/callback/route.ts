import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseStkCallback } from "@/lib/mpesa";
import { activateAiSessionFromPayment } from "@/lib/ai-session";
import { completeInvoicePaymentAfterMpesa } from "@/lib/invoice-payment-flow";
import { recordFromMpesaPayment } from "@/lib/finance-ledger";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = parseStkCallback(payload);

    if (!result?.checkoutRequestId) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const payment = await prisma.mpesaPayment.findUnique({
      where: { checkoutRequestId: result.checkoutRequestId },
    });

    if (!payment) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const success = result.resultCode === 0;

    await prisma.mpesaPayment.update({
      where: { id: payment.id },
      data: {
        status: success ? "completed" : "failed",
        resultCode: result.resultCode,
        resultDesc: result.resultDesc,
        mpesaReceiptNumber: result.mpesaReceiptNumber,
      },
    });

    if (success) {
      const updatedPayment = { ...payment, status: "completed" as const, mpesaReceiptNumber: result.mpesaReceiptNumber };
      await recordFromMpesaPayment(updatedPayment);
      if (payment.orderId) {
        await prisma.productOrder.update({
          where: { id: payment.orderId },
          data: { paymentStatus: "paid", status: "confirmed" },
        });
      }
      if (payment.financeDocumentId) {
        await completeInvoicePaymentAfterMpesa(payment.financeDocumentId, {
          amount: payment.amount,
          mpesaReceiptNumber: result.mpesaReceiptNumber,
        });
      }
      if (payment.referenceType === "ai_session") {
        await activateAiSessionFromPayment(payment.id);
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
