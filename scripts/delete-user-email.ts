/**
 * Permanently delete a user and related records (for fresh registration tests).
 * Usage: tsx --env-file=.env scripts/delete-user-email.ts wkabucho4@gmail.com
 */
import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient } from "@prisma/client";

ensureDatabaseUrl();
const prisma = new PrismaClient();

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Usage: tsx --env-file=.env scripts/delete-user-email.ts <email>");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  if (!user) {
    console.log(`No user found for ${email}`);
    return;
  }

  const { id } = user;
  console.log(`Deleting user: ${user.email} (${user.firstName} ${user.lastName}, ${user.role})`);

  await prisma.$transaction(
    async (tx) => {
      const projectIds = (
        await tx.project.findMany({ where: { clientId: id }, select: { id: true } })
      ).map((p) => p.id);
      if (projectIds.length) {
        await tx.project.deleteMany({ where: { id: { in: projectIds } } });
      }

      await tx.department.updateMany({ where: { hodId: id }, data: { hodId: null } });
      await tx.serviceWorkflow.updateMany({ where: { clientId: id }, data: { clientId: null } });
      await tx.solutionRequest.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.careerApplication.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.productOrder.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.blogPost.deleteMany({ where: { authorId: id } });
      await tx.testimonial.updateMany({ where: { userId: id }, data: { userId: null } });

      await tx.internalNotification.deleteMany({
        where: { OR: [{ recipientId: id }, { senderId: id }] },
      });
      await tx.message.deleteMany({ where: { senderId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.pointsTransaction.deleteMany({ where: { userId: id } });
      await tx.supportTicket.deleteMany({ where: { userId: id } });
      await tx.serviceRating.deleteMany({ where: { userId: id } });
      await tx.idea.deleteMany({ where: { userId: id } });
      await tx.authVerification.deleteMany({ where: { userId: id } });
      await tx.aiSession.deleteMany({ where: { userId: id } });
      await tx.employeeProfile.deleteMany({ where: { userId: id } });

      await tx.user.delete({ where: { id } });
    },
    { timeout: 60_000 }
  );

  console.log(`Deleted: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
