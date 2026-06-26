import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { rateLimit, validateOrigin } from "@/lib/security";
import { chatCompletion, isLlmConfigured } from "@/lib/ai-llm";
import { requireActiveAiSession } from "@/lib/ai-session";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string().optional(),
  message: z.string().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 30, 60_000);
  if (limited) return limited;
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const aiSession = await requireActiveAiSession(auth.user.id);
  if (!aiSession) {
    return NextResponse.json(
      {
        error: "payment_required",
        message: "Pay KES 100 via M-Pesa to unlock AI fine-tuning for 12 hours.",
      },
      { status: 402 }
    );
  }

  try {
    const body = schema.parse(await req.json());

    const systemPrompt = `You are an innovation coach at TechFlare Solutions. Help the innovator refine their idea with constructive, practical feedback — market fit, technical feasibility, risks, next steps, and pitch clarity. Be specific and encouraging.`;

    const seedUser = `Idea title: ${body.title}
Category: ${body.category || "General"}
Description: ${body.description}
${body.message ? `\nFollow-up question: ${body.message}` : "\nPlease fine-tune and strengthen this idea."}`;

    if (isLlmConfigured()) {
      const historyMessages = (body.history ?? []).slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await chatCompletion(
        [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: body.message ? body.message : seedUser },
        ],
        700
      );

      if (reply) {
        return NextResponse.json({ reply, sessionExpiresAt: aiSession.expiresAt });
      }
    }

    return NextResponse.json({
      reply: `**${body.title}** — refinement notes:\n\n1. Clarify the core problem and who benefits most.\n2. List 2–3 assumptions to validate with users or a small pilot.\n3. Outline a minimal prototype scope.\n4. Note IP considerations and partnership options with TechFlare.\n\n${body.message ? `On your question: ${body.message}` : "Add more detail in your portal and consider submitting to our Innovation Hub for full team review."}`,
      sessionExpiresAt: aiSession.expiresAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Fine-tune failed" }, { status: 500 });
  }
}
