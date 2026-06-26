/**
 * Test AI session activation + finance receipt.
 * Run: npx tsx --env-file=.env scripts/test-ai-session.ts
 */
import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient } from "@prisma/client";
import { activateAiSessionFromPayment } from "../src/lib/ai-session";

ensureDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "innovator@example.com" } });
  if (!user) throw new Error("innovator@example.com not found — run db:seed");

  const payment = await prisma.mpesaPayment.create({
    data: {
      phone: "254712345678",
      amount: 100,
      accountReference: `AITEST${Date.now()}`,
      description: "AI session test",
      referenceType: "ai_session",
      referenceId: "ai_self_service",
      userId: user.id,
      status: "completed",
      mpesaReceiptNumber: "TESTAI001",
    },
  });

  const session = await activateAiSessionFromPayment(payment.id);
  if (!session) throw new Error("Session activation failed");

  const receipt = session.financeDocId
    ? await prisma.financeDocument.findUnique({ where: { id: session.financeDocId } })
    : null;

  const active = await prisma.aiSession.findFirst({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
  });

  if (!active) throw new Error("No active session found");
  if (!receipt || receipt.docType !== "receipt") throw new Error("Finance receipt missing");

  console.log("[OK] AI session", session.id);
  console.log("[OK] Expires", session.expiresAt.toISOString());
  console.log("[OK] Receipt", receipt.number, "KES", receipt.total);
}

main()
  .catch((e) => {
    console.error("[FAIL]", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
