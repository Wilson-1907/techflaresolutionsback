import { prisma } from "./db";
import { sendEmail } from "./email";
import { getAppUrl } from "./env";
import { wrapBrandedEmail } from "./brand-email";
import { allocateFinanceDocumentNumber } from "./finance-number";
import { calculateFinanceTotals } from "./finance-calculations";
import { parseWorkflowStages, sumStageCosts, stageLineTotal } from "./workflow-stages";
import { notifyUser } from "./workflows";
import {
  generateDepositQrForInvoice,
  invoicePayUrl,
} from "./invoice-payment-flow";

type WorkflowWithClient = {
  id: string;
  title: string;
  financeDocId?: string | null;
  receiptDocId?: string | null;
  financeTotal?: number | null;
  depositPercent?: number | null;
  financeStages?: unknown;
  clientId?: string | null;
  client?: { firstName: string; lastName: string; email: string } | null;
};

export function depositAmount(workflow: { financeTotal?: number | null; depositPercent?: number | null }) {
  const total = workflow.financeTotal ?? 0;
  const pct = workflow.depositPercent ?? 60;
  return Math.round(total * (pct / 100));
}

export function buildWorkflowProposalEmailContent(
  workflow: WorkflowWithClient,
  invoiceNumber: string,
  depositDue: number,
  extras?: { payUrl?: string; qrBase64?: string | null; invoiceId?: string }
) {
  const client = workflow.client;
  const portalUrl = `${getAppUrl()}/portal/client`;
  const payUrl = extras?.payUrl || (extras?.invoiceId ? invoicePayUrl(extras.invoiceId) : portalUrl);
  const qrBase64 = extras?.qrBase64;
  const stages = parseWorkflowStages(workflow.financeStages);
  const depositPct = workflow.depositPercent ?? 60;
  const stageList = stages
    .map(
      (s, i) =>
        `${i + 1}. ${s.title}${s.quantity && s.quantity > 1 ? ` × ${s.quantity}` : ""}${
          s.cost != null ? ` — KES ${stageLineTotal(s).toLocaleString()}` : ""
        }${s.dueDate ? ` (due ${new Date(s.dueDate).toLocaleDateString("en-KE")})` : ""}`
    )
    .join("\n");

  const subject = `Action required: Invoice ${invoiceNumber} — ${workflow.title}`;
  const text = [
    client ? `Dear ${client.firstName},` : "Dear Client,",
    "",
    `Your proposal and invoice for "${workflow.title}" are ready in your client portal.`,
    "",
    `Invoice: ${invoiceNumber}`,
    `Deposit due (${depositPct}%): KES ${depositDue.toLocaleString()}`,
    workflow.financeTotal != null ? `Project total: KES ${workflow.financeTotal.toLocaleString()}` : "",
    "",
    stages.length ? "Stages:\n" + stageList : "",
    "",
    `Sign in to your portal to agree, decline, or speak with customer care before paying:`,
    portalUrl,
    "",
    `Pay your ${depositPct}% deposit when you are ready (KES ${depositDue.toLocaleString()}):`,
    `• Scan the QR code in this email with M-Pesa or My Safaricom app`,
    `• Or open ${payUrl} — choose Phone (STK prompt), Scan QR, or Manual till payment`,
    "",
    "Payment: M-Pesa Till 9356451 (TechFlare Solutions)",
    "",
    "TechFlare Solutions — Finance Office",
    "Signed: Kinyanjui Wilson, Treasury Department",
  ]
    .filter(Boolean)
    .join("\n");

  const html = wrapBrandedEmail(
    `
    <p>${client ? `Dear ${client.firstName},` : "Dear Client,"}</p>
    <p>Your proposal and invoice for <strong>${workflow.title}</strong> are ready.</p>
    <p><strong>Invoice:</strong> ${invoiceNumber}<br/>
    <strong>Deposit due (${depositPct}%):</strong> KES ${depositDue.toLocaleString()}<br/>
    ${workflow.financeTotal != null ? `<strong>Project total:</strong> KES ${workflow.financeTotal.toLocaleString()}<br/>` : ""}
    </p>
    ${stages.length ? `<p><strong>Stages:</strong></p><ul>${stages.map((s) => `<li>${s.title}${s.quantity && s.quantity > 1 ? ` × ${s.quantity}` : ""}${s.cost != null ? ` — KES ${stageLineTotal(s).toLocaleString()}` : ""}</li>`).join("")}</ul>` : ""}
    <p><a href="${portalUrl}">Open your portal</a> to agree, decline, or contact customer care.</p>
    <div style="margin:20px 0;padding:16px;border:1px solid #43B02A;border-radius:12px;background:#f6fff6;">
      <p style="margin:0 0 8px;font-weight:bold;color:#43B02A;">Pay deposit when you are ready — KES ${depositDue.toLocaleString()}</p>
      ${qrBase64 ? `<p style="margin:8px 0;font-size:13px;">Scan with <strong>M-Pesa</strong> or <strong>My Safaricom</strong>:</p><img src="cid:deposit-qr" alt="M-Pesa QR code" width="220" height="220" style="display:block;margin:8px auto;border:1px solid #ddd;border-radius:8px;" />` : ""}
      <p style="margin:12px 0 0;font-size:13px;">Or pay online: <a href="${payUrl}">${payUrl}</a></p>
      <p style="margin:8px 0 0;font-size:12px;color:#555;">Choose <strong>Phone</strong> (we send the M-Pesa prompt when you tap pay), <strong>Scan QR</strong>, or <strong>Manual</strong> (copy till 9356451).</p>
    </div>
    <p><strong>Payment:</strong> M-Pesa Till 9356451 (TechFlare Solutions)</p>
    <p style="margin-top:24px;color:#666;font-size:12px;">
      Signed,<br/>
      <strong>Kinyanjui Wilson</strong><br/>
      Treasury Department · TechFlare Solutions
    </p>
  `,
    "Treasury Department · Invoice & Proposal"
  );

  return {
    to: client?.email ?? null,
    subject,
    html,
    text,
  };
}

export async function createWorkflowDepositInvoice(
  workflow: {
    id: string;
    title: string;
    clientId?: string | null;
    financeDocId?: string | null;
    hodBrief?: string | null;
    financeNotes?: string | null;
    financeStages?: unknown;
    financeTotal?: number | null;
    depositPercent?: number | null;
  },
  stages: ReturnType<typeof parseWorkflowStages>,
  total: number,
  depositPct: number,
  financeNotes?: string
) {
  if (workflow.financeDocId) {
    return prisma.financeDocument.findUnique({ where: { id: workflow.financeDocId } });
  }
  if (!workflow.clientId) return null;

  const lineItems = invoiceLineItemsForDeposit({
    title: workflow.title,
    financeStages: stages,
    financeTotal: total,
    depositPercent: depositPct,
  });
  const totals = calculateFinanceTotals(lineItems, 0);
  const number = await allocateFinanceDocumentNumber(prisma, "invoice");

  const client = await prisma.user.findUnique({
    where: { id: workflow.clientId },
    select: { firstName: true, lastName: true, email: true, phone: true, company: true },
  });

  return prisma.financeDocument.create({
    data: {
      docType: "invoice",
      number,
      status: "draft",
      currency: "KES",
      subtotal: totals.subtotal,
      taxRate: 0,
      taxAmount: 0,
      total: totals.total || depositAmount({ financeTotal: total, depositPercent: depositPct }),
      lineItems: totals.lineItems,
      clientName: client ? `${client.firstName} ${client.lastName}` : "Client",
      clientEmail: client?.email ?? null,
      clientPhone: client?.phone ?? null,
      clientRole: client?.company ?? null,
      invoiceRef: number,
      paymentMethod: "M-Pesa Till 9356451",
      showOnMainSite: false,
      notes: [
        financeNotes || workflow.financeNotes || workflow.hodBrief || "",
        `Project total: KES ${total.toLocaleString()}. This invoice is for ${depositPct}% deposit.`,
      ]
        .filter(Boolean)
        .join("\n"),
      issuerName: "Kinyanjui Wilson",
      issuerTitle: "Treasury Department · TechFlare Solutions",
    },
  });
}

export async function sendWorkflowProposalEmail(
  workflow: WorkflowWithClient,
  invoiceNumber: string,
  depositDue: number,
  invoiceId?: string
) {
  const client = workflow.client;
  if (!client?.email) {
    throw new Error("Client has no email address on file — add email to their account before sending.");
  }

  const payUrl = invoiceId ? invoicePayUrl(invoiceId) : undefined;
  const qrBase64 = await generateDepositQrForInvoice(invoiceNumber, depositDue);
  const { subject, html, text } = buildWorkflowProposalEmailContent(workflow, invoiceNumber, depositDue, {
    payUrl,
    qrBase64,
    invoiceId,
  });

  if (qrBase64) {
    const { sendEmailWithAttachment } = await import("./email");
    await sendEmailWithAttachment(client.email, subject, html, text, [
      {
        filename: "mpesa-deposit-qr.png",
        content: Buffer.from(qrBase64, "base64"),
        cid: "deposit-qr",
      },
    ]);
    return;
  }

  await sendEmail(client.email, subject, html, text);
}

export async function trySendWorkflowProposalEmail(
  workflow: WorkflowWithClient,
  invoiceNumber: string,
  depositDue: number,
  invoiceId?: string
) {
  try {
    await sendWorkflowProposalEmail(workflow, invoiceNumber, depositDue, invoiceId);
    return { sent: true as const };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Could not send email";
    console.error("[workflow-email] proposal:", error);
    return { sent: false as const, error };
  }
}

export async function createDepositReceipt(
  workflow: WorkflowWithClient,
  payment: { amount: number; mpesaReceiptNumber?: string | null }
) {
  if (workflow.receiptDocId) {
    return prisma.financeDocument.findUnique({ where: { id: workflow.receiptDocId } });
  }

  const invoice = workflow.financeDocId
    ? await prisma.financeDocument.findUnique({ where: { id: workflow.financeDocId } })
    : null;

  const client = workflow.clientId
    ? await prisma.user.findUnique({
        where: { id: workflow.clientId },
        select: { firstName: true, lastName: true, email: true, phone: true, company: true },
      })
    : null;

  const number = await allocateFinanceDocumentNumber(prisma, "receipt");
  const lineItems = [
    {
      description: `60% deposit — ${workflow.title}`,
      qty: 1,
      unitPrice: payment.amount,
      lineTotal: payment.amount,
    },
  ];
  const totals = calculateFinanceTotals(lineItems, 0);

  const receipt = await prisma.financeDocument.create({
    data: {
      docType: "receipt",
      number,
      status: "paid",
      currency: "KES",
      subtotal: totals.subtotal,
      taxRate: 0,
      taxAmount: 0,
      total: totals.total || payment.amount,
      lineItems: totals.lineItems,
      clientName: client ? `${client.firstName} ${client.lastName}` : "Client",
      clientEmail: client?.email ?? null,
      clientPhone: client?.phone ?? null,
      clientRole: client?.company ?? null,
      invoiceRef: invoice?.number ?? null,
      paymentMethod: `M-Pesa ${payment.mpesaReceiptNumber || "Till 9356451"}`.trim(),
      paidAt: new Date(),
      notes: `Deposit receipt for ${workflow.title}`,
      issuerName: "Kinyanjui Wilson",
      issuerTitle: "Treasury Department · TechFlare Solutions",
    },
  });

  await prisma.serviceWorkflow.update({
    where: { id: workflow.id },
    data: { receiptDocId: receipt.id },
  });

  return receipt;
}

export async function sendWorkflowReceiptEmail(
  workflow: WorkflowWithClient,
  receipt: { number: string; total: number; invoiceRef?: string | null }
) {
  const client = workflow.client;
  if (!client?.email) return;

  const portalUrl = `${getAppUrl()}/portal/client/payments`;
  const subject = `Receipt ${receipt.number} — deposit received`;
  const text = [
    `Dear ${client.firstName},`,
    "",
    `Thank you — we received your deposit of KES ${receipt.total.toLocaleString()}.`,
    `Receipt: ${receipt.number}`,
    receipt.invoiceRef ? `Invoice ref: ${receipt.invoiceRef}` : "",
    "",
    `View your receipt in the portal: ${portalUrl}`,
    "",
    "Your HOD will assign the team and begin work. Track progress in your portal once delivery starts.",
    "",
    "Signed: Kinyanjui Wilson, Treasury Department · TechFlare Solutions",
  ]
    .filter(Boolean)
    .join("\n");

  const html = wrapBrandedEmail(
    `
    <p>Dear ${client.firstName},</p>
    <p>Thank you — we received your <strong>KES ${receipt.total.toLocaleString()}</strong> deposit.</p>
    <p><strong>Receipt:</strong> ${receipt.number}<br/>
    ${receipt.invoiceRef ? `<strong>Invoice ref:</strong> ${receipt.invoiceRef}<br/>` : ""}
    </p>
    <p><a href="${portalUrl}">View receipt in your portal</a></p>
    <p>Your HOD will assign the team and begin work. Progress tracking starts once delivery begins.</p>
    <p style="margin-top:24px;color:#666;font-size:12px;">
      Signed,<br/>
      <strong>Kinyanjui Wilson</strong><br/>
      Treasury Department · TechFlare Solutions
    </p>
  `,
    "Treasury Department · Receipt"
  );

  await sendEmail(client.email, subject, html, text);
  if (workflow.clientId) {
    await notifyUser(
      workflow.clientId,
      "Receipt issued",
      `Receipt ${receipt.number} for KES ${receipt.total.toLocaleString()} is in your portal under Payment history.`
    );
  }
}

export function invoiceLineItemsForDeposit(
  workflow: { title: string; financeStages?: unknown; financeTotal?: number | null; depositPercent?: number | null }
) {
  const stages = parseWorkflowStages(workflow.financeStages);
  const projectTotal = stages.length > 0 ? sumStageCosts(stages) : workflow.financeTotal ?? 0;
  const deposit = depositAmount({ financeTotal: projectTotal, depositPercent: workflow.depositPercent });
  const pct = workflow.depositPercent ?? 60;

  if (stages.length > 0) {
    return stages.map((s) => ({
      description: `${s.title} (${pct}% deposit)`,
      qty: s.quantity ?? 1,
      unitPrice: Math.round((s.cost ?? 0) * (pct / 100)),
    }));
  }

  return [{ description: `${workflow.title} — ${pct}% deposit`, qty: 1, unitPrice: deposit }];
}
