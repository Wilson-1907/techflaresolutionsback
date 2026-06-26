import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MPESA_TILL_NAME, MPESA_TILL_NUMBER } from "@/lib/mpesa";
import { createMpesaPaymentRecord, resolveMpesaCheckout } from "@/lib/mpesa-checkout";
import { rateLimit, validateOrigin } from "@/lib/security";

const schema = z.object({
  amount: z.number().positive(),
  referenceType: z.enum(["order", "invoice", "general", "ai_session"]),
  referenceId: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 20, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const resolved = await resolveMpesaCheckout(body);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { ctx } = resolved;

    const payment = await createMpesaPaymentRecord({ ...body, phone: "" }, ctx, {
      status: "manual",
      resultDesc: `Manual till payment to ${MPESA_TILL_NUMBER}`,
    });

    return NextResponse.json({
      mode: "manual",
      paymentId: payment.id,
      tillNumber: MPESA_TILL_NUMBER,
      tillName: MPESA_TILL_NAME,
      amount: body.amount,
      accountReference: ctx.accountReference,
      manualSteps: [
        "Open M-Pesa on your phone",
        "Lipa na M-Pesa → Buy Goods",
        `Till number: ${MPESA_TILL_NUMBER}`,
        `Amount: KES ${body.amount.toLocaleString()}`,
        "Enter your M-Pesa PIN to confirm",
      ],
      message: `Pay KES ${body.amount.toLocaleString()} to Till ${MPESA_TILL_NUMBER}. Reference: ${ctx.accountReference}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
