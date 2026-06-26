import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { rateLimit, validateOrigin } from "@/lib/security";
import { chatCompletion, isLlmConfigured } from "@/lib/ai-llm";
import { solutionsForIndustry } from "@/lib/industry-solutions";
import { requireActiveAiSession } from "@/lib/ai-session";

function generateProposal(problem: string, industry: string, budget: string) {
  const solutions = solutionsForIndustry(industry);

  const proposal = `Based on your challenge, TechFlare Solutions recommends the following approach:

**Recommended Solutions:**
${solutions.map((s, i) => `${i + 1}. ${s}`).join("\n")}

**Proposed Phases:**
1. Discovery & Requirements (2 weeks)
2. Research & Architecture Design (3 weeks)
3. Development & Iteration (8-12 weeks)
4. Testing, Deployment & Training (2 weeks)

**Why TechFlare Solutions:**
Our Innovation Hub methodology ensures your solution is researched, validated, and built to world-class standards — not just coded to spec.

A detailed proposal with technical specifications will be sent to your email within 48 hours.`;

  const budgetEstimates: Record<string, string> = {
    "under-10k": "$8,000 - $10,000",
    "10k-50k": "$15,000 - $45,000",
    "50k-100k": "$55,000 - $95,000",
    "100k-plus": "$100,000 - $250,000+",
  };

  return {
    proposal,
    estimatedCost: budgetEstimates[budget] || "$25,000 - $75,000",
  };
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 15, 60_000);
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
        message: "Pay KES 100 via M-Pesa to unlock the AI Proposal Generator for 12 hours.",
      },
      { status: 402 }
    );
  }

  try {
    const { problem, industry, budget } = await req.json();
    if (!problem) {
      return NextResponse.json({ error: "Problem description required" }, { status: 400 });
    }

    if (isLlmConfigured()) {
      try {
        const aiProposal = await chatCompletion(
          [
            {
              role: "system",
              content:
                "You are a solutions architect at TechFlare Solutions. Generate a concise project proposal with recommended solutions, phases, and estimated cost range. Be professional and specific.",
            },
            {
              role: "user",
              content: `Problem: ${problem}\nIndustry: ${industry}\nBudget: ${budget}`,
            },
          ],
          500
        );
        if (aiProposal) {
          return NextResponse.json({
            proposal: aiProposal,
            estimatedCost: generateProposal(problem, industry, budget).estimatedCost,
            sessionExpiresAt: aiSession.expiresAt,
          });
        }
      } catch {
        // fall through to rule-based
      }
    }

    return NextResponse.json({
      ...generateProposal(problem, industry, budget),
      sessionExpiresAt: aiSession.expiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Proposal generation failed" }, { status: 500 });
  }
}
