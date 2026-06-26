import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedOfficialContent } from "./official-content";
import { seedCatalogContent } from "./catalog-content";
import { seedDemoContent } from "./demo-content";

ensureDatabaseUrl();

const prisma = new PrismaClient();

async function main() {
  await seedOfficialContent(prisma);
  console.log("Official news and blog content seeded.");

  await seedCatalogContent(prisma);
  console.log("Job postings and product catalog seeded.");

  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_DATA !== "true") {
    console.log("Skipping demo seed in production. Set SEED_DEMO_DATA=true to run.");
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@techflaresolutions.com" },
    update: { emailVerified: true },
    create: {
      email: "admin@techflaresolutions.com",
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      emailVerified: true,
    },
  });

  await seedDemoContent(prisma);
  console.log("Full demo dataset seeded.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
