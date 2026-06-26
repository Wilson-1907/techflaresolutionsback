import { NextRequest, NextResponse } from "next/server";
import { rateLimit, validateOrigin } from "@/lib/security";
import { AI_SYSTEM_PROMPT, matchKnowledge } from "@/lib/ai-knowledge";
import { creativeFallback, matchNavigationIntent, type ChatResolution } from "@/lib/ai-navigation";
import { chatCompletion, isLlmConfigured } from "@/lib/ai-llm";

function getAIResponse(message: string): ChatResolution {
  const nav = matchNavigationIntent(message);
  if (nav) return nav;

  const matched = matchKnowledge(message);
  if (matched) return { reply: matched };

  if (isLlmConfigured()) {
    return { reply: "LLM_FALLBACK" };
  }

  return { reply: creativeFallback(message) };
}

/** Public site chatbot — no login required (rate-limited). */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 30, 60_000);
  if (limited) return limited;

  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const { message, history } = await req.json();
    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    let resolution = getAIResponse(message);
    let reply = resolution.reply;
    let action = resolution.action;

    if (reply === "LLM_FALLBACK" && isLlmConfigured()) {
      try {
        const historyMessages = Array.isArray(history)
          ? history.slice(-6).map((m: { role: string; content: string }) => ({
              role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
              content: m.content,
            }))
          : [];

        const llmReply = await chatCompletion([
          { role: "system", content: AI_SYSTEM_PROMPT },
          ...historyMessages,
          { role: "user", content: message },
        ]);

        const sanitized =
          llmReply && !/i don'?t know|i can'?t help|unable to assist/i.test(llmReply)
            ? llmReply
            : null;

        reply = sanitized || matchKnowledge(message) || creativeFallback(message);
      } catch (llmErr) {
        console.error("[ai/chat] LLM error:", llmErr);
        reply = matchKnowledge(message) || creativeFallback(message);
      }
    }

    return NextResponse.json({ reply, action, llm: isLlmConfigured() });
  } catch {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 500 });
  }
}
