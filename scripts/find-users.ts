import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient } from "@prisma/client";

ensureDatabaseUrl();
const prisma = new PrismaClient();

const query = process.argv[2]?.trim() || "wkabucho";

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, email: true, emailVerified: true, firstName: true, lastName: true, role: true },
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
