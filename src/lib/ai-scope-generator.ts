import { SERVICE_CATALOG } from "@/data/service-catalog";
import { applyDemandPrice, getDemandMultiplier } from "./service-catalog-pricing";
import { chatCompletion, isLlmConfigured } from "./ai-llm";
import { withStageDefaults, type WorkflowStage } from "./workflow-stages";

export type GeneratedScopeLine = WorkflowStage & {
  catalogServiceId?: string;
  timeline?: string;
};

function catalogForPrompt(multiplier: number) {
  return SERVICE_CATALOG.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    limits: s.limits,
    priceKes: applyDemandPrice(s.basePriceKes, multiplier),
    typicalTimeline: s.typicalTimeline,
    tags: s.tags,
  }));
}

function parseAiJson(text: string): { lines?: GeneratedScopeLine[]; summary?: string } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as { lines?: GeneratedScopeLine[]; summary?: string };
  } catch {
    return null;
  }
}

/** Rule-based fallback when LLM is unavailable. */
function fallbackScope(projectDescription: string, multiplier: number): GeneratedScopeLine[] {
  const text = projectDescription.toLowerCase();
  const lines: GeneratedScopeLine[] = [];
  const add = (id: string, overrides?: Partial<GeneratedScopeLine>) => {
    const svc = SERVICE_CATALOG.find((s) => s.id === id);
    if (!svc) return;
    lines.push({
      title: overrides?.title || svc.name,
      description: overrides?.description || svc.limits,
      cost: applyDemandPrice(svc.basePriceKes, multiplier),
      quantity: 1,
      timeline: overrides?.timeline || svc.typicalTimeline,
      catalogServiceId: id,
    });
  };

  const isBirthday =
    text.includes("birthday") || text.includes("celebration") || text.includes("happy");
  const hasPhotos = text.includes("photo") || text.includes("slider") || text.includes("slide");
  const hasSong = text.includes("song") || text.includes("music") || text.includes("audio");
  const isSimpleWeb =
    isBirthday || text.includes("simple") || text.includes("landing") || text.includes("small website");

  if (isSimpleWeb) {
    add("web-simple");
    if (hasPhotos || hasSong) add("content-media");
    add("deploy-hosting");
    return lines;
  }

  if (text.includes("mpesa") || text.includes("payment") || text.includes("stk")) {
    add("mpesa-integration");
  }
  if (text.includes("shop") || text.includes("ecommerce") || text.includes("store")) {
    add("web-ecommerce");
  } else if (text.includes("website") || text.includes("web app") || text.includes("portal")) {
    add("web-custom");
  }
  if (text.includes("mobile") || text.includes("app")) {
    add("mobile-app-mvp");
  }
  if (text.includes("ai") || text.includes("chatbot") || text.includes("assistant")) {
    add("ai-chatbot");
  }
  if (text.includes("deploy") || text.includes("host") || text.includes("domain")) {
    add("deploy-hosting");
  }
  if (lines.length === 0) {
    add("consulting-hour", {
      title: "Project scoping & discovery",
      description: "Initial technical review and written scope from your brief.",
      timeline: "1–2 days",
    });
  }
  return lines;
}

export async function generateScopeFromDescription(projectDescription: string) {
  const trimmed = projectDescription.trim();
  if (trimmed.length < 10) {
    throw new Error("Describe the project in at least a few sentences.");
  }

  const demand = await getDemandMultiplier();
  const catalog = catalogForPrompt(demand.multiplier);

  if (isLlmConfigured()) {
    const system = `You are TechFlare Solutions' finance scoping assistant. Given a project brief and service catalog, output ONLY valid JSON:
{
  "summary": "one sentence for the client",
  "lines": [
    {
      "title": "service name",
      "description": "what is included and limits",
      "cost": number (KES, use catalog prices),
      "quantity": 1,
      "timeline": "e.g. 2-3 days",
      "catalogServiceId": "catalog id or omit"
    }
  ]
}
Rules:
- Pick catalog services that match the brief; split into clear rows (e.g. development, deployment, design).
- Use current catalog prices; do not invent unrealistic prices.
- Every line needs a realistic timeline string.
- Typical deposit invoice lists 2-6 line items.`;

    const user = `Demand multiplier: ${demand.multiplier} (${demand.label})
Active projects: ${demand.activeProjects}

CATALOG:
${JSON.stringify(catalog, null, 2)}

PROJECT BRIEF:
${trimmed}`;

    try {
      const raw = await chatCompletion(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        1200
      );
      if (raw) {
        const parsed = parseAiJson(raw);
        if (parsed?.lines?.length) {
          const lines = withStageDefaults(
            parsed.lines.map((l) => ({
              title: String(l.title || "").trim(),
              description: l.description ? String(l.description) : undefined,
              cost: Number(l.cost) || 0,
              quantity: Math.max(1, Number(l.quantity) || 1),
              timeline: l.timeline ? String(l.timeline) : undefined,
              catalogServiceId: l.catalogServiceId,
            }))
          ) as GeneratedScopeLine[];
          return {
            summary: parsed.summary || "AI-generated scope from your project brief.",
            lines,
            demand,
            source: "ai" as const,
          };
        }
      }
    } catch (err) {
      console.error("[scope-ai]", err);
    }
  }

  const lines = withStageDefaults(fallbackScope(trimmed, demand.multiplier)) as GeneratedScopeLine[];
  return {
    summary: "Scope generated from catalog matching (AI offline — review and edit before sending to Finance).",
    lines,
    demand,
    source: "fallback" as const,
  };
}
