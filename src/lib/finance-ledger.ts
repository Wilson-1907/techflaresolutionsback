import { prisma } from "./db";

export type LedgerEntryInput = {
  entryType: "revenue" | "income" | "expense" | "salary" | "investment";
  direction: "in" | "out";
  category: string;
  amount: number;
  currency?: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  entryDate?: Date;
  notes?: string;
};

export async function recordLedgerEntry(input: LedgerEntryInput) {
  if (input.amount <= 0) return null;

  if (input.referenceType && input.referenceId) {
    const existing = await prisma.financeLedgerEntry.findUnique({
      where: {
        referenceType_referenceId: {
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
      },
    });
    if (existing) return existing;
  }

  return prisma.financeLedgerEntry.create({
    data: {
      entryType: input.entryType,
      direction: input.direction,
      category: input.category,
      amount: input.amount,
      currency: input.currency ?? "KES",
      description: input.description,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      entryDate: input.entryDate ?? new Date(),
      notes: input.notes ?? null,
    },
  });
}

export async function recordFromFinanceDocument(doc: {
  id: string;
  docType: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  clientName: string;
  paidAt?: Date | null;
  docDate: Date;
}) {
  if (doc.docType === "invoice" && ["sent", "paid"].includes(doc.status)) {
    await recordLedgerEntry({
      entryType: "revenue",
      direction: "in",
      category: "invoice",
      amount: doc.total,
      currency: doc.currency,
      description: `Invoice ${doc.number} — ${doc.clientName}`,
      referenceType: "invoice_revenue",
      referenceId: doc.id,
      entryDate: doc.docDate,
    });
  }

  if (doc.docType === "receipt" || (doc.docType === "invoice" && doc.status === "paid")) {
    const paidDate = doc.paidAt ?? doc.docDate;
    await recordLedgerEntry({
      entryType: "income",
      direction: "in",
      category: doc.docType === "receipt" ? "receipt" : "invoice_payment",
      amount: doc.total,
      currency: doc.currency,
      description:
        doc.docType === "receipt"
          ? `Receipt ${doc.number} — ${doc.clientName}`
          : `Payment received — Invoice ${doc.number}`,
      referenceType: doc.docType === "receipt" ? "receipt_income" : "invoice_paid",
      referenceId: doc.id,
      entryDate: paidDate,
    });
  }
}

export async function recordFromMpesaPayment(payment: {
  id: string;
  amount: number;
  status: string;
  description?: string | null;
  mpesaReceiptNumber?: string | null;
  referenceType?: string | null;
  createdAt: Date;
}) {
  if (payment.status !== "completed") return;

  await recordLedgerEntry({
    entryType: "income",
    direction: "in",
    category: "mpesa",
    amount: payment.amount,
    description: payment.description || `M-Pesa ${payment.mpesaReceiptNumber || payment.id}`,
    referenceType: "mpesa_payment",
    referenceId: payment.id,
    entryDate: payment.createdAt,
    notes: payment.mpesaReceiptNumber ? `M-Pesa ref: ${payment.mpesaReceiptNumber}` : undefined,
  });
}

export async function recordFromProductOrder(order: {
  id: string;
  productTitle: string;
  amountKes: number | null;
  paymentStatus: string;
  createdAt: Date;
}) {
  if (order.paymentStatus !== "paid" || !order.amountKes) return;

  await recordLedgerEntry({
    entryType: "income",
    direction: "in",
    category: "product_order",
    amount: order.amountKes,
    description: `Product order — ${order.productTitle}`,
    referenceType: "product_order",
    referenceId: order.id,
    entryDate: order.createdAt,
  });

  await recordLedgerEntry({
    entryType: "revenue",
    direction: "in",
    category: "product_order",
    amount: order.amountKes,
    description: `Product revenue — ${order.productTitle}`,
    referenceType: "product_revenue",
    referenceId: order.id,
    entryDate: order.createdAt,
  });
}

/** Backfill ledger from existing treasury data — idempotent. */
export async function syncFinanceLedger() {
  const [documents, payments, orders] = await Promise.all([
    prisma.financeDocument.findMany({
      where: { status: { in: ["sent", "paid"] } },
    }),
    prisma.mpesaPayment.findMany({ where: { status: "completed" } }),
    prisma.productOrder.findMany({ where: { paymentStatus: "paid" } }),
  ]);

  for (const doc of documents) {
    await recordFromFinanceDocument(doc);
  }
  for (const p of payments) {
    await recordFromMpesaPayment(p);
  }
  for (const o of orders) {
    await recordFromProductOrder(o);
  }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function buildFinanceReport(from?: Date, to?: Date) {
  await syncFinanceLedger();

  const start = from ?? new Date(new Date().getFullYear(), 0, 1);
  const end = to ?? new Date();

  const entries = await prisma.financeLedgerEntry.findMany({
    where: { entryDate: { gte: start, lte: end } },
    orderBy: { entryDate: "desc" },
  });

  const sum = (filter: (e: (typeof entries)[0]) => boolean) =>
    entries.filter(filter).reduce((s, e) => s + e.amount, 0);

  const revenue = sum((e) => e.entryType === "revenue");
  const income = sum((e) => e.entryType === "income" && e.direction === "in");
  const expenses = sum((e) => e.entryType === "expense" && e.direction === "out");
  const salaries = sum((e) => e.entryType === "salary" && e.direction === "out");
  const investmentOut = sum((e) => e.entryType === "investment" && e.direction === "out");
  const investmentIn = sum((e) => e.entryType === "investment" && e.direction === "in");

  const moneyIn = sum((e) => e.direction === "in");
  const moneyOut = sum((e) => e.direction === "out");
  const profit = moneyIn - moneyOut;

  const outstanding = await prisma.financeDocument.aggregate({
    where: { docType: "invoice", status: "sent" },
    _sum: { total: true },
    _count: true,
  });

  const monthlyMap = new Map<
    string,
    { revenue: number; income: number; expense: number; salary: number; investment: number; moneyIn: number; moneyOut: number }
  >();

  for (const e of entries) {
    const key = monthKey(e.entryDate);
    const row = monthlyMap.get(key) ?? {
      revenue: 0,
      income: 0,
      expense: 0,
      salary: 0,
      investment: 0,
      moneyIn: 0,
      moneyOut: 0,
    };

    if (e.entryType === "revenue") row.revenue += e.amount;
    if (e.entryType === "income" && e.direction === "in") row.income += e.amount;
    if (e.entryType === "expense" && e.direction === "out") row.expense += e.amount;
    if (e.entryType === "salary" && e.direction === "out") row.salary += e.amount;
    if (e.entryType === "investment") row.investment += e.direction === "out" ? e.amount : -e.amount;
    if (e.direction === "in") row.moneyIn += e.amount;
    else row.moneyOut += e.amount;

    monthlyMap.set(key, row);
  }

  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      ...row,
      profit: row.moneyIn - row.moneyOut,
    }));

  const categoryMap = new Map<string, { in: number; out: number }>();
  for (const e of entries) {
    const cur = categoryMap.get(e.category) ?? { in: 0, out: 0 };
    if (e.direction === "in") cur.in += e.amount;
    else cur.out += e.amount;
    categoryMap.set(e.category, cur);
  }

  const byCategory = [...categoryMap.entries()].map(([category, amounts]) => ({
    category,
    moneyIn: amounts.in,
    moneyOut: amounts.out,
    net: amounts.in - amounts.out,
  }));

  return {
    period: { from: start.toISOString(), to: end.toISOString() },
    summary: {
      revenue,
      income,
      expenses,
      salaries,
      investmentOut,
      investmentIn,
      moneyIn,
      moneyOut,
      profit,
      outstandingInvoices: outstanding._sum.total ?? 0,
      outstandingCount: outstanding._count,
    },
    monthly,
    byCategory,
    recentEntries: entries.slice(0, 50).map((e) => ({
      id: e.id,
      entryType: e.entryType,
      direction: e.direction,
      category: e.category,
      amount: e.amount,
      currency: e.currency,
      description: e.description,
      entryDate: e.entryDate.toISOString(),
      notes: e.notes,
    })),
  };
}
