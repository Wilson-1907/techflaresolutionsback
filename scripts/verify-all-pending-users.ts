import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient } from "@prisma/client";

ensureDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const pending = await prisma.user.findMany({
    where: { emailVerified: false },
    select: { id: true, email: true, firstName: true },
  });

  if (!pending.length) {
    console.log("No unverified users.");
    return;
  }

  await prisma.user.updateMany({
    where: { emailVerified: false },
    data: { emailVerified: true },
  });

  console.log(`Verified ${pending.length} user(s):`);
  for (const u of pending) {
    console.log(`  - ${u.email} (${u.firstName})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
