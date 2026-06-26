import { z } from "zod";

export const acceptedTermsField = z.literal(true, {
  errorMap: () => ({ message: "You must accept the Terms & Conditions to continue." }),
});

export const receiveCommunicationsField = z.boolean().optional().default(false);

export const consentFields = {
  acceptedTerms: acceptedTermsField,
  receiveCommunications: receiveCommunicationsField,
};

export async function applyMarketingOptIn(userId: string, receiveCommunications?: boolean) {
  if (!receiveCommunications) return;
  const { prisma } = await import("@/lib/db");
  await prisma.user.update({
    where: { id: userId },
    data: { marketingOptIn: true },
  });
}
