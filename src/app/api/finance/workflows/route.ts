import { NextRequest, NextResponse } from "next/server";

import { verifyFinanceApiKey, financeUnauthorized } from "@/lib/finance-api";

import { prisma } from "@/lib/db";

import {

  syncPendingWorkflows,

  workflowIncludes,

  notifyUser,

  updateWorkflowStatus,

  notifyHodDepositPaid,

} from "@/lib/workflows";

import { sumStageCosts, parseWorkflowStages, progressFromStages } from "@/lib/workflow-stages";

import {

  depositAmount,

  trySendWorkflowProposalEmail,

  sendWorkflowReceiptEmail,

  createDepositReceipt,

  createWorkflowDepositInvoice,

  buildWorkflowProposalEmailContent,

} from "@/lib/workflow-finance";

import {
  validateFinanceSendReady,
  recordProposalEmailAttempt,
} from "@/lib/workflow-finance-validation";

import { z } from "zod";



const FINANCE_QUEUE = ["HOD_BUDGET_SUBMITTED", "FINANCE_REVIEW"] as const;

function validationError(result: { ok: false; errors: string[] }) {
  return NextResponse.json({ error: result.errors[0], errors: result.errors }, { status: 400 });
}

async function attachInvoiceMeta<T extends { financeDocId: string | null; receiptDocId?: string | null }>(
  items: T[]
) {
  const docIds = [
    ...new Set(
      items.flatMap((w) => [w.financeDocId, w.receiptDocId].filter((id): id is string => Boolean(id)))
    ),
  ];
  if (docIds.length === 0) {
    return items.map((w) => ({ ...w, invoice: null as null | { id: string; number: string; total: number; status: string } }));
  }
  const docs = await prisma.financeDocument.findMany({
    where: { id: { in: docIds } },
    select: { id: true, number: true, total: true, status: true, docType: true },
  });
  const byId = new Map(docs.map((d) => [d.id, d]));
  return items.map((w) => {
    const inv = w.financeDocId ? byId.get(w.financeDocId) : null;
    return {
      ...w,
      invoice: inv
        ? { id: inv.id, number: inv.number, total: inv.total, status: inv.status }
        : null,
    };
  });
}



export async function GET(req: NextRequest) {

  if (!verifyFinanceApiKey(req)) return financeUnauthorized();



  await syncPendingWorkflows();



  const status = req.nextUrl.searchParams.get("status");

  const id = req.nextUrl.searchParams.get("id");

  const emailPreview = req.nextUrl.searchParams.get("emailPreview") === "1";



  if (id) {

    const workflow = await prisma.serviceWorkflow.findUnique({

      where: { id },

      include: workflowIncludes(),

    });

    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });



    if (emailPreview) {

      if (!workflow.financeDocId) {

        return NextResponse.json({ error: "Prepare the invoice first" }, { status: 400 });

      }

      const invoice = await prisma.financeDocument.findUnique({ where: { id: workflow.financeDocId } });

      if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });



      const dep = depositAmount(workflow);

      const emailPreviewContent = buildWorkflowProposalEmailContent(workflow, invoice.number, dep);

      return NextResponse.json({

        workflow,

        invoice: { id: invoice.id, number: invoice.number, total: invoice.total, status: invoice.status },

        emailPreview: emailPreviewContent,

      });

    }



    return NextResponse.json({ workflow });

  }



  const failedOnly = req.nextUrl.searchParams.get("failed") === "1";

  if (failedOnly) {
    const failedQueue = await prisma.serviceWorkflow.findMany({
      where: { emailDeliveryStatus: "failed" },
      include: workflowIncludes(),
      orderBy: { emailLastAttemptAt: "desc" },
      take: 50,
    });
    const items = await attachInvoiceMeta(failedQueue);
    return NextResponse.json({ items, failedCount: items.length });
  }

  const items = await prisma.serviceWorkflow.findMany({

    where: status

      ? { status: status as never }

      : { status: { in: [...FINANCE_QUEUE, "SENT_TO_CLIENT", "CLIENT_AGREED", "DEPOSIT_PAID"] } },

    include: workflowIncludes(),

    orderBy: { updatedAt: "desc" },

    take: 100,

  });



  const queue = items.filter((w) => FINANCE_QUEUE.includes(w.status as (typeof FINANCE_QUEUE)[number]));



  const failedQueue = items.filter((w) => w.emailDeliveryStatus === "failed");

  const enriched = await attachInvoiceMeta(items);

  return NextResponse.json({
    items: enriched,
    queueCount: queue.length,
    failedQueue: enriched.filter((w) => w.emailDeliveryStatus === "failed"),
    failedCount: failedQueue.length,
  });

}



const patchSchema = z.object({

  action: z.enum([

    "finance_review",

    "finance_prepare_invoice",

    "finance_send_to_client",

    "finance_approve_and_send",

    "retry_client_email",

    "record_deposit",

    "start_work",

    "send_receipt",

  ]),

  financeNotes: z.string().optional(),

  financeTotal: z.number().optional(),

  depositPercent: z.number().min(1).max(100).optional(),

  mpesaReceiptNumber: z.string().min(3).max(32).optional(),

  invoiceNumber: z.string().optional(),

  financeStages: z

    .array(

      z.object({

        title: z.string(),

        description: z.string().optional(),

        cost: z.number().optional(),

        quantity: z.number().min(1).optional(),

        dueDate: z.string().optional().nullable(),

      })

    )

    .optional(),

});



export async function PATCH(req: NextRequest) {

  if (!verifyFinanceApiKey(req)) return financeUnauthorized();



  const id = req.nextUrl.searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Workflow id required" }, { status: 400 });



  try {

    const body = patchSchema.parse(await req.json());

    const workflow = await prisma.serviceWorkflow.findUnique({

      where: { id },

      include: workflowIncludes(),

    });

    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });



    let invoiceMeta: { id: string; number: string; total: number; status: string } | null = null;
    let depositMessage: string | undefined;
    let emailResult: { sent: boolean; error?: string } | undefined;



    switch (body.action) {

      case "finance_review": {

        const stages = parseWorkflowStages(body.financeStages ?? workflow.financeStages ?? workflow.hodStages);

        const depositPct = body.depositPercent ?? workflow.depositPercent ?? 60;

        const check = validateFinanceSendReady({
          clientEmail: workflow.client?.email,
          financeDocId: workflow.financeDocId,
          rawStages: stages,
          depositPercent: depositPct,
          requirePreparedInvoice: false,
        });

        if (!check.ok) return validationError(check);

        const total = stages.length > 0 ? sumStageCosts(stages) : body.financeTotal ?? workflow.hodBudget ?? undefined;

        await updateWorkflowStatus(id, "FINANCE_REVIEW", {

          financeNotes: body.financeNotes,

          financeTotal: total,

          financeStages: stages.length > 0 ? stages : undefined,

          progress: progressFromStages(stages),

          ...(body.depositPercent != null ? { depositPercent: body.depositPercent } : {}),

        });

        break;

      }



      case "finance_prepare_invoice": {

        if (!["HOD_BUDGET_SUBMITTED", "FINANCE_REVIEW"].includes(workflow.status)) {

          return NextResponse.json({ error: "Workflow not in finance review" }, { status: 400 });

        }

        const stages = parseWorkflowStages(

          body.financeStages ?? workflow.financeStages ?? workflow.hodStages

        );

        const total =

          stages.length > 0

            ? sumStageCosts(stages)

            : body.financeTotal ?? workflow.financeTotal ?? workflow.hodBudget ?? 0;

        const depositPct = body.depositPercent ?? workflow.depositPercent ?? 60;

        const check = validateFinanceSendReady({
          clientEmail: workflow.client?.email,
          financeDocId: workflow.financeDocId,
          rawStages: stages,
          depositPercent: depositPct,
          requirePreparedInvoice: false,
        });

        if (!check.ok) return validationError(check);



        const invoice = await createWorkflowDepositInvoice(

          workflow,

          stages,

          total,

          depositPct,

          body.financeNotes

        );

        if (!invoice) {

          return NextResponse.json({ error: "Could not create invoice — client required" }, { status: 400 });

        }



        await updateWorkflowStatus(id, "FINANCE_REVIEW", {

          financeNotes: body.financeNotes,

          financeTotal: total,

          financeStages: stages,

          financeDocId: invoice.id,

          depositPercent: depositPct,

          progress: 0,

        });



        invoiceMeta = { id: invoice.id, number: invoice.number, total: invoice.total, status: invoice.status };

        break;

      }



      case "finance_send_to_client": {

        if (!["FINANCE_REVIEW"].includes(workflow.status)) {

          return NextResponse.json({ error: "Prepare invoice in finance stage first" }, { status: 400 });

        }

        if (!workflow.financeDocId) {

          return NextResponse.json({ error: "No invoice prepared — use Prepare invoice first" }, { status: 400 });

        }



        const stages = parseWorkflowStages(

          body.financeStages ?? workflow.financeStages ?? workflow.hodStages

        );

        const total =

          stages.length > 0

            ? sumStageCosts(stages)

            : body.financeTotal ?? workflow.financeTotal ?? workflow.hodBudget ?? 0;

        const depositPct = body.depositPercent ?? workflow.depositPercent ?? 60;

        const sendCheck = validateFinanceSendReady({
          clientEmail: workflow.client?.email,
          financeDocId: workflow.financeDocId,
          rawStages: stages,
          depositPercent: depositPct,
          requirePreparedInvoice: true,
        });

        if (!sendCheck.ok) return validationError(sendCheck);



        const invoice = await prisma.financeDocument.update({

          where: { id: workflow.financeDocId },

          data: { status: "sent", showOnMainSite: true },

        });



        const updated = await updateWorkflowStatus(id, "SENT_TO_CLIENT", {

          financeNotes: body.financeNotes ?? workflow.financeNotes,

          financeTotal: total,

          financeStages: stages,

          depositPercent: depositPct,

        });



        if (workflow.clientId) {

          await notifyUser(

            workflow.clientId,

            "Action required: proposal & invoice",

            "Review stages and invoice in your portal — agree, decline, or contact customer care before paying your deposit."

          );

          emailResult = await trySendWorkflowProposalEmail(

            { ...updated, client: updated.client ?? undefined },

            invoice.number,

            depositAmount({ financeTotal: total, depositPercent: depositPct }),

            invoice.id

          );

          await recordProposalEmailAttempt(prisma, id, emailResult);

        }



        invoiceMeta = { id: invoice.id, number: invoice.number, total: invoice.total, status: invoice.status };

        break;

      }



      case "finance_approve_and_send": {

        if (!["HOD_BUDGET_SUBMITTED", "FINANCE_REVIEW"].includes(workflow.status)) {

          return NextResponse.json({ error: "Workflow not awaiting finance review" }, { status: 400 });

        }



        const stages = parseWorkflowStages(

          body.financeStages ?? workflow.financeStages ?? workflow.hodStages

        );

        const total =

          stages.length > 0

            ? sumStageCosts(stages)

            : body.financeTotal ?? workflow.financeTotal ?? workflow.hodBudget ?? 0;

        const depositPct = body.depositPercent ?? workflow.depositPercent ?? 60;

        const approveCheck = validateFinanceSendReady({
          clientEmail: workflow.client?.email,
          financeDocId: workflow.financeDocId,
          rawStages: stages,
          depositPercent: depositPct,
          requirePreparedInvoice: false,
        });

        if (!approveCheck.ok) return validationError(approveCheck);



        let invoice = workflow.financeDocId

          ? await prisma.financeDocument.findUnique({ where: { id: workflow.financeDocId } })

          : null;



        if (!invoice) {

          invoice = await createWorkflowDepositInvoice(

            workflow,

            stages,

            total,

            depositPct,

            body.financeNotes

          );

          if (!invoice) {

            return NextResponse.json({ error: "Could not create invoice — client required" }, { status: 400 });

          }



          await updateWorkflowStatus(id, "FINANCE_REVIEW", {

            financeNotes: body.financeNotes,

            financeTotal: total,

            financeStages: stages,

            financeDocId: invoice.id,

            depositPercent: depositPct,

            progress: 0,

          });

        }



        const sentInvoice = await prisma.financeDocument.update({

          where: { id: invoice.id },

          data: { status: "sent", showOnMainSite: true },

        });



        const updated = await updateWorkflowStatus(id, "SENT_TO_CLIENT", {

          financeNotes: body.financeNotes ?? workflow.financeNotes,

          financeTotal: total,

          financeStages: stages,

          depositPercent: depositPct,

        });



        if (workflow.clientId) {

          await notifyUser(

            workflow.clientId,

            "Action required: proposal & invoice",

            "Review stages and invoice in your portal — agree, decline, or contact customer care before paying your deposit."

          );

          emailResult = await trySendWorkflowProposalEmail(

            { ...updated, client: updated.client ?? undefined },

            sentInvoice.number,

            depositAmount({ financeTotal: total, depositPercent: depositPct }),

            sentInvoice.id

          );

          await recordProposalEmailAttempt(prisma, id, emailResult);

        }



        invoiceMeta = {

          id: sentInvoice.id,

          number: sentInvoice.number,

          total: sentInvoice.total,

          status: sentInvoice.status,

        };

        break;

      }



      case "retry_client_email": {

        if (!workflow.financeDocId) {

          return NextResponse.json({ error: "No invoice prepared — cannot resend email" }, { status: 400 });

        }

        const stages = parseWorkflowStages(

          body.financeStages ?? workflow.financeStages ?? workflow.hodStages

        );

        const total =

          stages.length > 0

            ? sumStageCosts(stages)

            : body.financeTotal ?? workflow.financeTotal ?? workflow.hodBudget ?? 0;

        const depositPct = body.depositPercent ?? workflow.depositPercent ?? 60;

        const retryCheck = validateFinanceSendReady({

          clientEmail: workflow.client?.email,

          financeDocId: workflow.financeDocId,

          rawStages: stages,

          depositPercent: depositPct,

          requirePreparedInvoice: true,

        });

        if (!retryCheck.ok) return validationError(retryCheck);

        const invoice = await prisma.financeDocument.findUnique({ where: { id: workflow.financeDocId } });

        if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

        emailResult = await trySendWorkflowProposalEmail(

          {

            ...workflow,

            financeStages: stages,

            financeTotal: total,

            depositPercent: depositPct,

            client: workflow.client ?? undefined,

          },

          invoice.number,

            depositAmount({ financeTotal: total, depositPercent: depositPct }),

            invoice.id

          );

        await recordProposalEmailAttempt(prisma, id, emailResult);

        if (!emailResult.sent) {

          return NextResponse.json(

            { error: emailResult.error, errors: [emailResult.error ?? "Email failed"], email: emailResult },

            { status: 502 }

          );

        }

        break;

      }



      case "record_deposit": {

        if (!body.mpesaReceiptNumber?.trim()) {

          return NextResponse.json(

            { error: "Enter the M-Pesa confirmation code from the client's payment." },

            { status: 400 }

          );

        }

        const invoice = workflow.financeDocId

          ? await prisma.financeDocument.findUnique({ where: { id: workflow.financeDocId } })

          : null;

        if (!invoice) {

          return NextResponse.json({ error: "No invoice linked to this workflow." }, { status: 400 });

        }

        const invoiceNumber = body.invoiceNumber?.trim() || invoice.number;

        try {

          const { issueReceiptFromVerifiedMpesa } = await import("@/lib/receipt-verification");

          const issued = await issueReceiptFromVerifiedMpesa(invoiceNumber, body.mpesaReceiptNumber, {
            manualConfirm: true,
          });

          if (!issued.ok) {

            return NextResponse.json({ error: issued.error }, { status: 400 });

          }

          depositMessage = issued.alreadyIssued
            ? "Receipt already on file for this invoice."
            : issued.emailed
              ? "M-Pesa verified. Receipt generated and emailed to the client."
              : "M-Pesa verified. Receipt generated.";

          const updated = await prisma.serviceWorkflow.findUnique({
            where: { id },
            include: workflowIncludes(),
          });

          return NextResponse.json({
            ok: true,
            message: depositMessage,
            workflow: updated
              ? {
                  id: updated.id,
                  status: updated.status,
                  depositPaid: updated.depositPaid,
                  receiptDocId: updated.receiptDocId,
                }
              : { id, status: "DEPOSIT_PAID", depositPaid: true },
            receipt: issued.receipt
              ? { id: issued.receipt.id, number: issued.receipt.number, total: issued.receipt.total }
              : null,
          });

        } catch (depositErr) {

          console.error("record_deposit:", depositErr);

          return NextResponse.json(

            {

              error:

                depositErr instanceof Error

                  ? depositErr.message

                  : "Could not verify deposit — check M-Pesa code and try again.",

            },

            { status: 500 }

          );

        }

        break;

      }



      case "send_receipt": {

        const full = await prisma.serviceWorkflow.findUnique({

          where: { id },

          include: workflowIncludes(),

        });

        if (!full?.depositPaid) {

          return NextResponse.json({ error: "Deposit not paid yet" }, { status: 400 });

        }

        let receipt = full.receiptDocId

          ? await prisma.financeDocument.findUnique({ where: { id: full.receiptDocId } })

          : null;

        if (!receipt) {

          receipt = await createDepositReceipt(full, { amount: depositAmount(full) });

        }

        if (receipt) await sendWorkflowReceiptEmail(full, receipt);

        break;

      }



      case "start_work": {

        const stages = parseWorkflowStages(workflow.financeStages ?? workflow.hodStages);

        await updateWorkflowStatus(id, "WORK_STARTED", {

          workStarted: true,

          workStartedAt: new Date(),

          financeStages: stages,

          progress: progressFromStages(stages),

        });

        if (workflow.clientId) {

          await notifyUser(workflow.clientId, "Work started", "Your project is in progress — track it in your portal.");

        }

        break;

      }

    }



    const updated = await prisma.serviceWorkflow.findUnique({
      where: { id },
      include: workflowIncludes(),
    });

    try {
      return NextResponse.json({ workflow: updated, invoice: invoiceMeta, message: depositMessage, email: emailResult });
    } catch (serErr) {
      console.error("finance workflows PATCH serialize:", serErr);
      return NextResponse.json({
        ok: true,
        message: depositMessage || "Workflow updated.",
        workflow: updated ? { id: updated.id, status: updated.status } : { id },
      });
    }

  } catch (e) {

    if (e instanceof z.ZodError) {

      return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    }

    const message = e instanceof Error ? e.message : "Update failed";
    console.error("finance workflows PATCH:", e);
    return NextResponse.json({ error: message }, { status: 500 });

  }

}

