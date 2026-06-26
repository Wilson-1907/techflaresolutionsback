import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient } from "@prisma/client";

ensureDatabaseUrl();
const prisma = new PrismaClient();

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Usage: tsx --env-file=.env scripts/verify-user-email.ts <email>");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true, emailVerified: true },
  });

  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  if (user.emailVerified) {
    console.log(`Already verified: ${user.email} (${user.firstName} ${user.lastName})`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
  });

  await prisma.authVerification.updateMany({
    where: { userId: user.id, type: "EMAIL_VERIFY", usedAt: null },
    data: { usedAt: new Date() },
  });

  console.log(`Verified: ${user.email} (${user.firstName} ${user.lastName})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
