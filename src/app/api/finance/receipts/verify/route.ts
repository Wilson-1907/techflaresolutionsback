import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyFinanceApiKey, financeUnauthorized } from "@/lib/finance-api";
import { issueReceiptFromVerifiedMpesa } from "@/lib/receipt-verification";

const schema = z.object({
  invoiceNumber: z.string().min(3),
  mpesaReceiptNumber: z.string().min(3).max(32),
});

export async function POST(req: NextRequest) {
  if (!verifyFinanceApiKey(req)) return financeUnauthorized();

  try {
    const body = schema.parse(await req.json());
    const result = await issueReceiptFromVerifiedMpesa(body.invoiceNumber, body.mpesaReceiptNumber, {
      manualConfirm: true,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: result.alreadyIssued
        ? "Receipt already on file for this invoice."
        : result.emailed
          ? "M-Pesa code verified. Receipt generated and emailed to the client."
          : "M-Pesa code verified. Receipt generated (no client email on file).",
      receipt: result.receipt,
      invoice: {
        id: result.invoice.id,
        number: result.invoice.number,
        status: "paid",
        total: result.invoice.total,
      },
      payment: {
        id: result.payment.id,
        amount: result.payment.amount,
        mpesaReceiptNumber: result.payment.mpesaReceiptNumber,
      },
      alreadyIssued: result.alreadyIssued,
      emailed: result.emailed,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter invoice number and M-Pesa confirmation code." }, { status: 400 });
    }
    console.error("receipt verify:", e);
    return NextResponse.json({ error: "Could not verify payment or issue receipt." }, { status: 500 });
  }
}
