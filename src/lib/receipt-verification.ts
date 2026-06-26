import { prisma } from "./db";
import { allocateFinanceDocumentNumber } from "./finance-number";
import { calculateFinanceTotals } from "./finance-calculations";
import {
  createDepositReceipt,
  sendWorkflowReceiptEmail,
} from "./workflow-finance";
import { markWorkflowDepositPaidByFinanceDoc } from "./workflows";
import { depositAmount } from "./workflow-finance";

export function normalizeMpesaCode(code: string) {
  return code.trim().toUpperCase();
}

export async function findInvoiceByNumber(invoiceNumber: string) {
  const number = invoiceNumber.trim();
  return prisma.financeDocument.findFirst({
    where: { docType: "invoice", number },
  });
}

export async function findCompletedMpesaPaymentForInvoice(
  invoiceId: string,
  invoiceNumber: string,
  mpesaReceiptNumber: string
) {
  const code = normalizeMpesaCode(mpesaReceiptNumber);
  if (!code) return null;

  const candidates = await prisma.mpesaPayment.findMany({
    where: {
      status: "completed",
      OR: [
        { financeDocumentId: invoiceId },
        { referenceType: "invoice", referenceId: invoiceId },
        { accountReference: { contains: invoiceNumber.replace(/\//g, "").slice(0, 12) } },
        { description: { contains: invoiceNumber } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    candidates.find(
      (p) => p.mpesaReceiptNumber && normalizeMpesaCode(p.mpesaReceiptNumber) === code
    ) ?? null
  );
}

export async function verifyMpesaForInvoice(invoiceNumber: string, mpesaReceiptNumber: string) {
  const invoice = await findInvoiceByNumber(invoiceNumber);
  if (!invoice) {
    return { ok: false as const, error: `Invoice ${invoiceNumber} not found.` };
  }

  const payment = await findCompletedMpesaPaymentForInvoice(
    invoice.id,
    invoice.number,
    mpesaReceiptNumber
  );

  if (!payment) {
    const codeUsedElsewhere = await prisma.mpesaPayment.findFirst({
      where: {
        status: "completed",
        mpesaReceiptNumber: { equals: normalizeMpesaCode(mpesaReceiptNumber), mode: "insensitive" },
      },
    });
    if (codeUsedElsewhere) {
      return {
        ok: false as const,
        error:
          "This M-Pesa code exists in the system but is not linked to this invoice. Check the invoice number.",
      };
    }
    return {
      ok: false as const,
      error:
        "M-Pesa code not found for this invoice. The client must pay via M-Pesa (STK or Till) so the confirmation is recorded, then try again.",
    };
  }

  const workflow = await prisma.serviceWorkflow.findFirst({
    where: { financeDocId: invoice.id },
    select: { depositPercent: true, financeTotal: true, depositPaid: true },
  });

  const expectedDeposit = workflow && !workflow.depositPaid ? depositAmount(workflow) : null;
  const matchesDeposit =
    expectedDeposit != null && Math.abs(payment.amount - expectedDeposit) <= 1;
  const matchesFull = Math.abs(payment.amount - invoice.total) <= 1;

  if (!matchesDeposit && !matchesFull) {
    const hint =
      expectedDeposit != null
        ? `Expected deposit KES ${expectedDeposit.toLocaleString()} or full invoice KES ${invoice.total.toLocaleString()}.`
        : `Expected KES ${invoice.total.toLocaleString()}.`;
    return {
      ok: false as const,
      error: `Amount mismatch: M-Pesa payment is KES ${payment.amount.toLocaleString()}. ${hint}`,
    };
  }

  return { ok: true as const, invoice, payment };
}

/** Finance trusted path: record Till/SMS payment when STK did not create a row yet. */
async function ensureFinanceMpesaPayment(
  invoice: {
    id: string;
    number: string;
    total: number;
    clientPhone: string | null;
  },
  mpesaReceiptNumber: string
): Promise<{ ok: true; payment: { id: string; amount: number; mpesaReceiptNumber: string | null } } | { ok: false; error: string }> {
  const code = normalizeMpesaCode(mpesaReceiptNumber);
  if (!code) {
    return { ok: false, error: "Enter a valid M-Pesa confirmation code." };
  }

  const byCode = await prisma.mpesaPayment.findFirst({
    where: {
      status: "completed",
      mpesaReceiptNumber: { equals: code, mode: "insensitive" },
    },
  });
  if (byCode) {
    const linked =
      byCode.financeDocumentId === invoice.id ||
      (byCode.referenceType === "invoice" && byCode.referenceId === invoice.id);
    if (linked) {
      return { ok: true, payment: byCode };
    }
    return {
      ok: false,
      error: "This M-Pesa code is already linked to a different payment. Check the code and invoice.",
    };
  }

  const workflow = await prisma.serviceWorkflow.findFirst({
    where: { financeDocId: invoice.id },
    select: { depositPercent: true, financeTotal: true, depositPaid: true },
  });
  const amount =
    workflow && !workflow.depositPaid ? depositAmount(workflow) : invoice.total;

  const payment = await prisma.mpesaPayment.create({
    data: {
      phone: invoice.clientPhone || "finance-verified",
      amount,
      accountReference: invoice.number.replace(/\//g, "").slice(0, 20),
      description: `Finance verified — ${invoice.number}`,
      referenceType: "invoice",
      referenceId: invoice.id,
      financeDocumentId: invoice.id,
      mpesaReceiptNumber: code,
      status: "completed",
    },
  });

  return { ok: true, payment };
}

async function createStandaloneReceipt(
  invoice: {
    id: string;
    number: string;
    total: number;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    clientRole: string | null;
  },
  payment: { amount: number; mpesaReceiptNumber: string | null }
) {
  const receiptNumber = await allocateFinanceDocumentNumber(prisma, "receipt");
  const lineItems = [
    {
      description: `Payment for invoice ${invoice.number}`,
      qty: 1,
      unitPrice: payment.amount,
      lineTotal: payment.amount,
    },
  ];
  const totals = calculateFinanceTotals(lineItems, 0);

  return prisma.financeDocument.create({
    data: {
      docType: "receipt",
      number: receiptNumber,
      status: "paid",
      currency: "KES",
      subtotal: totals.subtotal,
      taxRate: 0,
      taxAmount: 0,
      total: totals.total || payment.amount,
      lineItems: totals.lineItems,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      clientRole: invoice.clientRole,
      invoiceRef: invoice.number,
      paymentMethod: `M-Pesa ${payment.mpesaReceiptNumber || "Till 9356451"}`.trim(),
      paidAt: new Date(),
      showOnMainSite: true,
      notes: `Receipt for invoice ${invoice.number}`,
      issuerName: "Kinyanjui Wilson",
      issuerTitle: "Treasury Department · TechFlare Solutions",
    },
  });
}

export async function issueReceiptFromVerifiedMpesa(
  invoiceNumber: string,
  mpesaReceiptNumber: string,
  options?: { manualConfirm?: boolean }
) {
  let verified = await verifyMpesaForInvoice(invoiceNumber, mpesaReceiptNumber);

  if (!verified.ok && options?.manualConfirm) {
    const invoice = await findInvoiceByNumber(invoiceNumber);
    if (!invoice) {
      return { ok: false as const, error: `Invoice ${invoiceNumber} not found.` };
    }
    const ensured = await ensureFinanceMpesaPayment(invoice, mpesaReceiptNumber);
    if (!ensured.ok) {
      return { ok: false as const, error: ensured.error };
    }
    verified = await verifyMpesaForInvoice(invoiceNumber, mpesaReceiptNumber);
  }

  if (!verified.ok) {
    return { ok: false as const, error: verified.error };
  }

  const { invoice, payment } = verified;

  const existingReceipt = await prisma.financeDocument.findFirst({
    where: { docType: "receipt", invoiceRef: invoice.number },
    orderBy: { createdAt: "desc" },
  });

  if (invoice.status === "paid" && existingReceipt) {
    return {
      ok: true as const,
      receipt: existingReceipt,
      invoice,
      payment,
      alreadyIssued: true,
      emailed: false,
    };
  }

  if (invoice.status !== "paid") {
    await prisma.financeDocument.update({
      where: { id: invoice.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        paymentMethod: `M-Pesa ${payment.mpesaReceiptNumber || ""}`.trim(),
      },
    });
  }

  const workflow = await prisma.serviceWorkflow.findFirst({
    where: { financeDocId: invoice.id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  let receipt = existingReceipt;

  if (workflow) {
    if (!workflow.depositPaid) {
      await markWorkflowDepositPaidByFinanceDoc(invoice.id, {
        amount: payment.amount,
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
      });
    }
    const updated = await prisma.serviceWorkflow.findUnique({
      where: { id: workflow.id },
      select: { receiptDocId: true, depositPaid: true },
    });
    if (updated?.receiptDocId) {
      receipt = await prisma.financeDocument.findUnique({ where: { id: updated.receiptDocId } });
    }
  }

  if (!receipt) {
    receipt = await createStandaloneReceipt(invoice, payment);
  }

  let emailed = false;
  if (workflow?.client?.email && receipt) {
    try {
      await sendWorkflowReceiptEmail(
        { ...workflow, client: workflow.client },
        {
          number: receipt.number,
          total: receipt.total,
          invoiceRef: receipt.invoiceRef,
        }
      );
      emailed = true;
    } catch (err) {
      console.error("sendWorkflowReceiptEmail:", err);
    }
  } else if (invoice.clientEmail && receipt) {
    try {
      const { sendEmail } = await import("./email");
      const { wrapBrandedEmail } = await import("./brand-email");
      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://techflare-solutions.com"}/portal/client/payments`;
      await sendEmail(
        invoice.clientEmail,
        `Receipt ${receipt.number} — payment confirmed`,
        wrapBrandedEmail(
          `<p>Dear ${invoice.clientName},</p><p>Your payment for invoice <strong>${invoice.number}</strong> is confirmed.</p><p>Receipt: <strong>${receipt.number}</strong></p><p><a href="${portalUrl}">View in your portal</a></p>`,
          "Treasury Department · Receipt"
        ),
        `Receipt ${receipt.number} for invoice ${invoice.number}. View: ${portalUrl}`
      );
      emailed = true;
    } catch (err) {
      console.error("receipt email:", err);
    }
  }

  if (workflow?.clientId) {
    const { notifyUser } = await import("./workflows");
    await notifyUser(
      workflow.clientId,
      "Receipt issued",
      `Receipt ${receipt?.number} for invoice ${invoice.number} is in your portal.`
    );
  }

  return {
    ok: true as const,
    receipt,
    invoice,
    payment,
    alreadyIssued: Boolean(existingReceipt),
    emailed,
  };
}
