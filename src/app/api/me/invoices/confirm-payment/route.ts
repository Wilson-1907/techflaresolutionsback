import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { issueReceiptFromVerifiedMpesa } from "@/lib/receipt-verification";

const schema = z.object({
  invoiceId: z.string().min(1),
  mpesaReceiptNumber: z.string().min(3).max(32),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const invoice = await prisma.financeDocument.findUnique({
      where: { id: body.invoiceId },
      select: { id: true, number: true, docType: true, clientEmail: true, status: true },
    });

    if (!invoice || invoice.docType !== "invoice") {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json({ message: "Invoice already paid", alreadyPaid: true });
    }

    const workflow = await prisma.serviceWorkflow.findFirst({
      where: { financeDocId: invoice.id },
      select: { clientId: true },
    });

    if (workflow?.clientId && workflow.clientId !== session.id) {
      return NextResponse.json({ error: "Not your invoice" }, { status: 403 });
    }

    if (!workflow?.clientId && invoice.clientEmail && invoice.clientEmail !== session.email) {
      return NextResponse.json({ error: "Not your invoice" }, { status: 403 });
    }

    const result = await issueReceiptFromVerifiedMpesa(invoice.number, body.mpesaReceiptNumber, {
      manualConfirm: true,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: result.alreadyIssued
        ? "Payment already recorded. Receipt is in your portal."
        : "Payment confirmed. Receipt sent to your email and portal. Your HOD will start work.",
      receipt: result.receipt
        ? { id: result.receipt.id, number: result.receipt.number, total: result.receipt.total }
        : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not confirm payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
