import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initiateStkPush, isMpesaConfigured, MPESA_TILL_NUMBER } from "@/lib/mpesa";
import { createMpesaPaymentRecord, resolveMpesaCheckout } from "@/lib/mpesa-checkout";
import { rateLimit, validateOrigin } from "@/lib/security";

const schema = z.object({
  phone: z.string().min(9),
  amount: z.number().positive(),
  referenceType: z.enum(["order", "invoice", "general", "ai_session"]),
  referenceId: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 15, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const resolved = await resolveMpesaCheckout(body, req);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { ctx } = resolved;

    if (!isMpesaConfigured()) {
      const payment = await createMpesaPaymentRecord(body, ctx, {
        status: "manual",
        resultDesc: `Pay manually to Till ${MPESA_TILL_NUMBER}`,
      });

      return NextResponse.json({
        mode: "manual",
        tillNumber: MPESA_TILL_NUMBER,
        amount: body.amount,
        accountReference: ctx.accountReference,
        paymentId: payment.id,
        message: `Pay KES ${body.amount} to Till ${MPESA_TILL_NUMBER} (${ctx.accountReference}) then contact us with your M-Pesa confirmation.`,
      });
    }

    const stk = await initiateStkPush({
      phone: body.phone,
      amount: body.amount,
      accountReference: ctx.accountReference,
      description: ctx.description,
    });

    const payment = await createMpesaPaymentRecord(body, ctx, {
      status: "pending",
      checkoutRequestId: stk.checkoutRequestId,
      merchantRequestId: stk.merchantRequestId,
    });

    return NextResponse.json({
      mode: "stk",
      paymentId: payment.id,
      checkoutRequestId: stk.checkoutRequestId,
      tillNumber: MPESA_TILL_NUMBER,
      accountReference: ctx.accountReference,
      message: stk.customerMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment initiation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
