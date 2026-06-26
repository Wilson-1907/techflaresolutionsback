import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyAdminApiKey, adminUnauthorized } from "@/lib/admin-api";
import { verifyFinanceApiKey, financeUnauthorized } from "@/lib/finance-api";
import {
  calculateFinanceTotals,
  calculatePaymentSplits,
  type LineItem,
} from "@/lib/finance-calculations";
import { allocateFinanceDocumentNumber, isValidTfsInvoiceReference, peekNextFinanceDocumentNumber } from "@/lib/finance-number";
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

const documentSchema = z
  .object({
    docType: z.enum(["invoice", "receipt"]),
    status: z.enum(["draft", "sent", "paid", "cancelled"]).optional(),
    currency: z.string().optional(),
    taxRate: z.number().min(0).optional(),
    lineItems: z.array(lineItemSchema).min(1),
    splits: z.array(splitSchema).optional(),
    clientName: z.string().min(2),
    clientEmail: z.string().email().optional().or(z.literal("")),
    clientPhone: z.string().optional(),
    clientRole: z.string().optional(),
    clientAddress: z.string().optional(),
    issuerName: z.string().optional(),
    issuerTitle: z.string().optional(),
    invoiceRef: z.string().optional(),
    paymentMethod: z.string().optional(),
    notes: z.string().optional(),
    showOnMainSite: z.boolean().optional(),
    dueDate: z.string().datetime().optional(),
    docDate: z.string().datetime().optional(),
    paidAt: z.string().datetime().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.docType === "receipt") {
      const ref = data.invoiceRef?.trim();
      if (!ref) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invoice reference is required for receipts",
          path: ["invoiceRef"],
        });
        return;
      }
      if (!isValidTfsInvoiceReference(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invoice reference must match TFS/YY/MM/001 (e.g. TFS/26/06/001)",
          path: ["invoiceRef"],
        });
      }
    }
  });

function canReadFinance(req: NextRequest) {
  return verifyFinanceApiKey(req) || verifyAdminApiKey(req);
}

function canWriteFinance(req: NextRequest) {
  return verifyFinanceApiKey(req);
}

export async function GET(req: NextRequest) {
  const docType = req.nextUrl.searchParams.get("type");
  const includeAll = req.nextUrl.searchParams.get("all") === "true";
  const publicOnly = req.nextUrl.searchParams.get("public") === "true";
  const nextNumber = req.nextUrl.searchParams.get("nextNumber");

  if (nextNumber === "true" || nextNumber === "1") {
    if (!canReadFinance(req)) return financeUnauthorized();
    const kind = docType === "receipt" ? "receipt" : "invoice";
    const number = await peekNextFinanceDocumentNumber(prisma, kind);
    return NextResponse.json({ nextNumber: number });
  }

  if (publicOnly) {
    const documents = await prisma.financeDocument.findMany({
      where: {
        showOnMainSite: true,
        status: { in: ["sent", "paid"] },
        ...(docType ? { docType } : {}),
      },
      orderBy: { docDate: "desc" },
    });
    return NextResponse.json({ documents });
  }

  if (!canReadFinance(req)) {
    return financeUnauthorized();
  }

  const documents = await prisma.financeDocument.findMany({
    where: {
      ...(docType ? { docType } : {}),
      ...(includeAll ? {} : undefined),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  if (!canWriteFinance(req)) return financeUnauthorized();

  try {
    const body = documentSchema.parse(await req.json());
    const taxRate = body.taxRate ?? 0;
    const totals = calculateFinanceTotals(body.lineItems as LineItem[], taxRate);
    const splits = body.splits?.length
      ? calculatePaymentSplits(totals.total, body.splits)
      : null;

    const docDate = body.docDate ? new Date(body.docDate) : new Date();
    const number = await allocateFinanceDocumentNumber(prisma, body.docType, docDate);

    let invoiceRef: string;
    if (body.docType === "invoice") {
      invoiceRef = number;
    } else {
      invoiceRef = body.invoiceRef!.trim();
      const linkedInvoice = await prisma.financeDocument.findFirst({
        where: { docType: "invoice", number: invoiceRef },
      });
      if (!linkedInvoice) {
        return NextResponse.json(
          { error: `Invoice ${invoiceRef} not found. Create the invoice first.` },
          { status: 400 }
        );
      }
    }

    const document = await prisma.financeDocument.create({
      data: {
        docType: body.docType,
        number,
        status: body.status ?? "draft",
        currency: body.currency ?? "KES",
        subtotal: totals.subtotal,
        taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        lineItems: totals.lineItems,
        splits: splits === null ? Prisma.DbNull : splits,
        clientName: body.clientName,
        clientEmail: body.clientEmail || null,
        clientPhone: body.clientPhone || null,
        clientRole: body.clientRole || null,
        clientAddress: body.clientAddress || null,
        issuerName: body.issuerName ?? "Kinyanjui Wilson",
        issuerTitle: body.issuerTitle ?? "Treasury Department · TechFlare Solutions",
        invoiceRef,
        paymentMethod: body.paymentMethod || null,
        notes: body.notes || null,
        showOnMainSite: body.showOnMainSite ?? false,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        docDate,
        paidAt: body.paidAt ? new Date(body.paidAt) : null,
      },
    });

    await recordFromFinanceDocument(document);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create finance document" }, { status: 500 });
  }
}
