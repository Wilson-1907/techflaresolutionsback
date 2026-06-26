import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient } from "@prisma/client";

ensureDatabaseUrl();
const prisma = new PrismaClient();

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Usage: tsx --env-file=.env scripts/unverify-user-email.ts <email>");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: false },
    select: { email: true, firstName: true },
  });
  console.log(`Unverified: ${user.email} (${user.firstName})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
