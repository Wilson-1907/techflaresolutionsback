import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVerifiedAuth } from "@/lib/api-guard";
import { rateLimit, validateOrigin } from "@/lib/security";
import { z } from "zod";

const schema = z.object({
  productSlug: z.string().min(1),
  productTitle: z.string().min(1),
  plan: z.string().min(1),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  organization: z.string().optional(),
  notes: z.string().optional(),
  amountKes: z.number().positive().optional(),
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (body.website) {
      return NextResponse.json({ error: "Rejected" }, { status: 400 });
    }

    const data = schema.parse(body);
    const auth = await requireVerifiedAuth();
    if (auth instanceof NextResponse) return auth;
    const session = auth.user;

    const emailBody = [
      `Product Order Request — ${data.productTitle}`,
      ``,
      `Plan: ${data.plan}`,
      data.amountKes ? `Amount: KES ${data.amountKes}` : "",
      `Payment: Official email stechflare@gmail.com (60% deposit, 40% at delivery/demo)`,
      `Customer: ${data.customerName}`,
      `Email: ${data.customerEmail}`,
      `Phone: ${data.customerPhone || "Not provided"}`,
      `Organization: ${data.organization || "Not provided"}`,
      ``,
      `Additional Notes:`,
      data.notes || "None",
      ``,
      `Terms accepted: Yes`,
      `Submitted via TechFlare Solutions website`,
    ].join("\n");

    const order = await prisma.productOrder.create({
      data: {
        productSlug: data.productSlug,
        productTitle: data.productTitle,
        plan: data.plan,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        organization: data.organization,
        message: emailBody,
        amountKes: data.amountKes,
        userId: session?.id,
      },
    });

    const solutionsEmail = process.env.NEXT_PUBLIC_SOLUTIONS_EMAIL || "stechflare@gmail.com";
    const mailto = `mailto:${solutionsEmail}?subject=${encodeURIComponent(
      `Order Request: ${data.productTitle} (${data.plan})`
    )}&body=${encodeURIComponent(emailBody)}`;

    return NextResponse.json({
      id: order.id,
      message: "Order saved. Send the prepared email to complete your request.",
      mailto,
      emailPreview: emailBody,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }
    return NextResponse.json({ error: "Order failed" }, { status: 500 });
  }
}
