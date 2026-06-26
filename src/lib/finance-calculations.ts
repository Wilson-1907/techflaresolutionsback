export type LineItem = {
  description: string;
  qty: number;
  unitPrice: number;
};

export type PaymentSplit = {
  party: string;
  percent: number;
  amount: number;
};

export function calculateFinanceTotals(lineItems: LineItem[], taxRate = 0) {
  const normalized = lineItems.map((item) => ({
    ...item,
    qty: Math.max(1, item.qty || 1),
    unitPrice: Math.max(0, item.unitPrice || 0),
    total: Math.max(1, item.qty || 1) * Math.max(0, item.unitPrice || 0),
  }));

  const subtotal = normalized.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (Math.max(0, taxRate) / 100);
  const total = subtotal + taxAmount;

  return { lineItems: normalized, subtotal, taxAmount, total };
}

export function calculatePaymentSplits(total: number, splits: { party: string; percent: number }[]): PaymentSplit[] {
  if (!splits.length) return [];

  const normalized = splits.map((s) => ({
    party: s.party.trim(),
    percent: Math.max(0, s.percent),
  }));

  const percentSum = normalized.reduce((sum, s) => sum + s.percent, 0) || 100;

  return normalized.map((s) => ({
    party: s.party,
    percent: s.percent,
    amount: Math.round((total * (s.percent / percentSum)) * 100) / 100,
  }));
}

/** @deprecated Use backend allocateFinanceDocumentNumber — TFS/{year}/{month}/{seq} */
export function generateFinanceNumber(docType: "invoice" | "receipt") {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(100 + Math.random() * 900)).padStart(3, "0");
  return docType === "invoice" ? `TFS/${year}/${month}/${seq}` : `TFS/RCP/${year}/${month}/${seq}`;
}
