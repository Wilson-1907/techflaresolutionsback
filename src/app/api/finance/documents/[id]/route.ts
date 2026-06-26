import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey } from "@/lib/admin-api";
import { verifyFinanceApiKey, financeUnauthorized } from "@/lib/finance-api";
import {
  calculateFinanceTotals,
  calculatePaymentSplits,
  type LineItem,
} from "@/lib/finance-calculations";
import { isValidTfsInvoiceReference } from "@/lib/finance-number";
import { recordFromFinanceDocument } from "@/lib/finance-ledger";

const lineItemSchema = z.object({
  description: z.string().min(1),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
});

const splitSchema = z.object({
  party: z.string().min(1),
  percent: z.number().min(0),
});

const updateSchema = z.object({
  status: z.enum(["draft", "sent", "paid", "cancelled"]).optional(),
  taxRate: z.number().min(0).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  splits: z.array(splitSchema).optional().nullable(),
  clientName: z.string().min(2).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")).nullable(),
  clientPhone: z.string().optional().nullable(),
  clientRole: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  invoiceRef: z
    .string()
    .trim()
    .min(1, "Invoice reference is required")
    .refine(isValidTfsInvoiceReference, {
      message: "Invoice reference must match TFS/YY/MM/001 (e.g. TFS/26/06/001)",
    })
    .optional(),
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  showOnMainSite: z.boolean().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  docDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional().nullable(),
});

function canReadFinance(req: NextRequest) {
  return verifyFinanceApiKey(req) || verifyAdminApiKey(req);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!canReadFinance(req)) return financeUnauthorized();
  const { id } = await params;

  const document = await prisma.financeDocument.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ document });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyFinanceApiKey(req)) return financeUnauthorized();
  const { id } = await params;

  try {
    const body = updateSchema.parse(await req.json());
    const existing = await prisma.financeDocument.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const lineItems = (body.lineItems ?? existing.lineItems) as LineItem[];
    const taxRate = body.taxRate ?? existing.taxRate;
    const totals = calculateFinanceTotals(lineItems, taxRate);
    const splits =
      body.splits === null
        ? null
        : body.splits?.length
          ? calculatePaymentSplits(totals.total, body.splits)
          : (existing.splits as typeof body.splits) ?? null;

    const updateData: Prisma.FinanceDocumentUpdateInput = {
      status: body.status,
      subtotal: totals.subtotal,
      taxRate,
      taxAmount: totals.taxAmount,
      total: totals.total,
      lineItems: totals.lineItems,
      splits: splits === null ? Prisma.DbNull : splits,
      clientName: body.clientName,
      clientEmail: body.clientEmail === "" ? null : body.clientEmail,
      clientPhone: body.clientPhone,
      clientRole: body.clientRole,
      clientAddress: body.clientAddress,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      showOnMainSite: body.showOnMainSite,
      dueDate: body.dueDate === null ? null : body.dueDate ? new Date(body.dueDate) : undefined,
      docDate: body.docDate ? new Date(body.docDate) : undefined,
      paidAt: body.paidAt === null ? null : body.paidAt ? new Date(body.paidAt) : undefined,
    };

    if (existing.docType === "invoice") {
      updateData.invoiceRef = existing.number;
    } else if (body.invoiceRef !== undefined) {
      const linkedInvoice = await prisma.financeDocument.findFirst({
        where: { docType: "invoice", number: body.invoiceRef },
      });
      if (!linkedInvoice) {
        return NextResponse.json(
          { error: `Invoice ${body.invoiceRef} not found` },
          { status: 400 }
        );
      }
      updateData.invoiceRef = body.invoiceRef;
    }

    const document = await prisma.financeDocument.update({
      where: { id },
      data: updateData,
    });

    await recordFromFinanceDocument(document);

    return NextResponse.json({ document });
  } catch {
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyFinanceApiKey(req)) return financeUnauthorized();
  const { id } = await params;

  try {
    await prisma.financeDocument.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
