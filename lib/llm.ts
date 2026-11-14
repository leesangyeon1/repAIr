import Anthropic from "@anthropic-ai/sdk";

/**
 * Optional LLM adapter. Only used when ANTHROPIC_API_KEY is set; the app is fully functional
 * without it (answers are then extractive quotes from the retrieved sources).
 *
 * The model is given numbered evidence quotes and must answer from them alone. Telem and Tavily
 * are retrieval services: neither writes this text.
 */

export type LlmEvidence = { index: number; title: string; host: string; quote: string };

export function llmConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

const SYSTEM = `You write short, grounded maintenance explanations for the repAIr demo.
Rules:
- Use only the numbered evidence quotes supplied by the user message. Cite each claim with its number in square brackets, e.g. [1].
- If the evidence does not answer the question, say plainly that the retrieved evidence is incomplete and state what it does cover.
- The "demo graph context" is synthetic seed data for a fictional machine. You may mention it only when labelled as the demo graph; never present it as a verified finding.
- Do not invent repair steps, part numbers, values or sources.
- Plain prose, at most 110 words, no headings or bullet lists.`;

export async function explainWithLlm(input: {
  query: string;
  graphContext: string;
  evidence: LlmEvidence[];
}): Promise<string | null> {
  if (!llmConfigured() || !input.evidence.length) return null;
  const client = new Anthropic({ timeout: 25_000, maxRetries: 0 });
  const evidenceText = input.evidence
    .map((e) => `[${e.index}] ${e.title} (${e.host}): "${e.quote}"`)
    .join("\n");

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Question: ${input.query}\n\nDemo graph context (synthetic): ${input.graphContext || "none"}\n\nEvidence:\n${evidenceText}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.warn(`[repAIr] LLM explanation skipped (status ${err.status ?? "n/a"})`);
    } else {
      console.warn("[repAIr] LLM explanation skipped");
    }
    return null;
  }
}
