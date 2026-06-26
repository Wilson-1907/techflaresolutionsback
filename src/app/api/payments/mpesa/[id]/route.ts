import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payment = await prisma.mpesaPayment.findFirst({
    where: { OR: [{ id }, { checkoutRequestId: id }] },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json({
    payment: {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      mpesaReceiptNumber: payment.mpesaReceiptNumber,
      resultDesc: payment.resultDesc,
      accountReference: payment.accountReference,
    },
  });
}
