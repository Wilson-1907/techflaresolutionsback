import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateDynamicQrCode,
  isMpesaQrConfigured,
  MPESA_TILL_NAME,
  MPESA_TILL_NUMBER,
} from "@/lib/mpesa";
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

    if (!isMpesaQrConfigured()) {
      const payment = await createMpesaPaymentRecord({ ...body, phone: "" }, ctx, {
        status: "manual",
        resultDesc: `Pay manually to Till ${MPESA_TILL_NUMBER}`,
      });

      return NextResponse.json({
        mode: "manual",
        tillNumber: MPESA_TILL_NUMBER,
        tillName: MPESA_TILL_NAME,
        amount: body.amount,
        accountReference: ctx.accountReference,
        paymentId: payment.id,
        message: "QR API not configured yet. Use manual till payment or STK push.",
      });
    }

    const qr = await generateDynamicQrCode({
      amount: body.amount,
      accountReference: ctx.accountReference,
      merchantName: MPESA_TILL_NAME,
    });

    const payment = await createMpesaPaymentRecord({ ...body, phone: "" }, ctx, {
      status: "pending",
      resultDesc: "Awaiting M-Pesa QR scan payment",
    });

    return NextResponse.json({
      mode: "qr",
      paymentId: payment.id,
      tillNumber: MPESA_TILL_NUMBER,
      tillName: MPESA_TILL_NAME,
      amount: body.amount,
      accountReference: ctx.accountReference,
      qrCodeBase64: qr.qrCodeBase64,
      message: qr.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QR generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
