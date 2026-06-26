/**
 * Send a verification OTP to an email (production DB).
 * Usage: tsx --env-file=.env scripts/send-test-otp.ts wkabucho4@gmail.com
 *
 * Requires RESEND_API_KEY (or BREVO_API_KEY / SMTP_*) in .env or environment.
 */
import { ensureDatabaseUrl } from "../src/lib/database-url";
import { PrismaClient } from "@prisma/client";
import { createVerification } from "../src/lib/verification";
import { getEmailConfigStatus, trySendVerificationEmail } from "../src/lib/email";

ensureDatabaseUrl();
const prisma = new PrismaClient();

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Usage: tsx --env-file=.env scripts/send-test-otp.ts <email>");
  process.exit(1);
}

async function main() {
  const config = getEmailConfigStatus();
  console.log("Email config:", JSON.stringify(config, null, 2));

  if (!config.configured) {
    console.error("No email provider configured. Set RESEND_API_KEY in .env or on Render.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, emailVerified: true },
  });

  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  if (user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: false },
    });
    console.log(`Temporarily marked ${email} as unverified for OTP test.`);
  }

  const verification = await createVerification(user.id, "EMAIL_VERIFY", 24 * 60);
  const { sent, error } = await trySendVerificationEmail(
    user.email,
    user.firstName,
    verification.code,
    verification.token
  );

  if (!sent) {
    console.error("Failed to send:", error);
    process.exit(1);
  }

  console.log(`OTP sent to ${email} (code also logged server-side only in dev).`);
  console.log("Check inbox and spam. User can verify at /verify-email");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
