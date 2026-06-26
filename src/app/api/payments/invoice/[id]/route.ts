import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.financeDocument.findUnique({ where: { id } });

  if (!doc || !doc.showOnMainSite || doc.status === "cancelled") {
    return NextResponse.json({ error: "Invoice not available" }, { status: 404 });
  }

  return NextResponse.json({
    invoice: {
      id: doc.id,
      number: doc.number,
      docType: doc.docType,
      total: doc.total,
      currency: doc.currency,
      status: doc.status,
      clientName: doc.clientName,
      dueDate: doc.dueDate,
    },
  });
}
