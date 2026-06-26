import { NextRequest, NextResponse } from "next/server";
import { verifyFinanceApiKey, financeUnauthorized } from "@/lib/finance-api";
import { prisma } from "@/lib/db";
import { recordLedgerEntry, syncFinanceLedger } from "@/lib/finance-ledger";
import { z } from "zod";

const postSchema = z.object({
  entryType: z.enum(["expense", "salary", "investment", "income"]),
  direction: z.enum(["in", "out"]).optional(),
  category: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().optional(),
  description: z.string().min(1),
  entryDate: z.string().optional(),
  notes: z.string().optional(),
});

const CATEGORY_DEFAULTS: Record<string, { direction: "in" | "out"; category: string }> = {
  expense: { direction: "out", category: "vendor" },
  salary: { direction: "out", category: "payroll" },
  investment: { direction: "out", category: "capex" },
  income: { direction: "in", category: "other" },
};

export async function GET(req: NextRequest) {
  if (!verifyFinanceApiKey(req)) return financeUnauthorized();

  await syncFinanceLedger();

  const type = req.nextUrl.searchParams.get("type");
  const direction = req.nextUrl.searchParams.get("direction");
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit") || 100));

  const entries = await prisma.financeLedgerEntry.findMany({
    where: {
      ...(type ? { entryType: type } : {}),
      ...(direction ? { direction } : {}),
    },
    orderBy: { entryDate: "desc" },
    take: limit,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      entryDate: e.entryDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!verifyFinanceApiKey(req)) return financeUnauthorized();

  try {
    const body = postSchema.parse(await req.json());
    const defaults = CATEGORY_DEFAULTS[body.entryType];
    const direction = body.direction ?? defaults.direction;
    const category = body.category ?? defaults.category;
    const entryType =
      body.entryType === "income" ? "income" : body.entryType;

    const entry = await recordLedgerEntry({
      entryType,
      direction,
      category,
      amount: body.amount,
      currency: body.currency,
      description: body.description,
      referenceType: "manual",
      referenceId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      entryDate: body.entryDate ? new Date(body.entryDate) : new Date(),
      notes: body.notes,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to record entry" }, { status: 500 });
  }
}
