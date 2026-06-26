import type { ExtendedPrisma } from "@/lib/db";

/** TFS/26/06/001 — 2-digit year / month / sequence */
export const TFS_INVOICE_REF_PATTERN = /^TFS\/(\d{2}|\d{4})\/\d{2}\/\d+$/;

/** TFS/RCP/26/06/001 */
export const TFS_RECEIPT_REF_PATTERN = /^TFS\/RCP\/(\d{2}|\d{4})\/\d{2}\/\d+$/;

export function isValidTfsInvoiceReference(value: string): boolean {
  return TFS_INVOICE_REF_PATTERN.test(value.trim());
}

/** TFS/26/06/001 — year (2-digit) / month / invoice sequence (3 digits) */
export function formatTfsInvoiceReference(year: number, month: number, sequence: number): string {
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");
  return `TFS/${yy}/${mm}/${seq}`;
}

/** TFS/RCP/26/06/001 — receipt counterpart */
export function formatTfsReceiptReference(year: number, month: number, sequence: number): string {
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");
  return `TFS/RCP/${yy}/${mm}/${seq}`;
}

function monthPrefixes(docType: "invoice" | "receipt", year: number, month: number): string[] {
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  if (docType === "invoice") {
    return [`TFS/${yy}/${mm}/`, `TFS/${year}/${mm}/`];
  }
  return [`TFS/RCP/${yy}/${mm}/`, `TFS/RCP/${year}/${mm}/`];
}

function parseSequence(number: string, prefix: string): number {
  if (!number.startsWith(prefix)) return 0;
  const seq = parseInt(number.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : 0;
}

export async function allocateFinanceDocumentNumber(
  prisma: Pick<ExtendedPrisma, "financeDocument">,
  docType: "invoice" | "receipt",
  docDate: Date = new Date()
): Promise<string> {
  const year = docDate.getFullYear();
  const month = docDate.getMonth() + 1;
  const prefixes = monthPrefixes(docType, year, month);

  const existing = await prisma.financeDocument.findMany({
    where: {
      docType,
      OR: prefixes.map((prefix) => ({ number: { startsWith: prefix } })),
    },
    select: { number: true },
  });

  let maxSeq = 0;
  for (const doc of existing) {
    for (const prefix of prefixes) {
      maxSeq = Math.max(maxSeq, parseSequence(doc.number, prefix));
    }
  }

  const next = maxSeq + 1;
  return docType === "invoice"
    ? formatTfsInvoiceReference(year, month, next)
    : formatTfsReceiptReference(year, month, next);
}

export async function peekNextFinanceDocumentNumber(
  prisma: Pick<ExtendedPrisma, "financeDocument">,
  docType: "invoice" | "receipt",
  docDate: Date = new Date()
): Promise<string> {
  return allocateFinanceDocumentNumber(prisma, docType, docDate);
}
