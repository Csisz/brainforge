import { z } from "zod";

/**
 * AI ABSTRACTION LAYER (PRD §10: "OpenAI, Claude, Gemini abstraction layer")
 * --------------------------------------------------------------------------
 * Design decisions:
 *
 * 1. The LLM NEVER produces geometry or answers. It produces *language*:
 *    themed framing stories, instruction variants, daily-plan narration.
 *    Worksheet correctness lives in deterministic generators. This keeps
 *    cost low, output reproducible, and — critical in a children's product —
 *    makes AI text a decorative layer that can be schema-validated and,
 *    on any failure, silently replaced by a static fallback string.
 *
 * 2. Every AI call goes through complete(): one narrow interface, structured
 *    output enforced with zod. Providers are adapters behind it, selected by
 *    env config, so switching or mixing providers is a config change.
 *
 * 3. Child-safety: system prompts pin the audience (age, tone), outputs are
 *    length-capped and schema-validated. Anything that fails validation is
 *    discarded — the product must fully work with AI disabled.
 */

export type AIProviderId = "anthropic" | "openai" | "google";

export type CompletionRequest = {
  /** Stable identifier of the prompt template — for logging & cost tracking. */
  task: "theme_story" | "instruction_variant" | "session_narration";
  system: string;
  user: string;
  maxTokens: number;
};

export interface AIProvider {
  id: AIProviderId;
  complete(req: CompletionRequest): Promise<string>;
}

/** Validate + parse a JSON completion against a schema; null on any failure. */
export async function completeJson<T>(
  provider: AIProvider,
  req: CompletionRequest,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const raw = await provider.complete(req);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = schema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // fallback strings take over — AI is decorative, never load-bearing
  }
}

/* ------------------------------------------------------------------ */
/* Adapters — implemented in Sprint 2 alongside the session UI.        */
/* Each is ~30 lines of fetch against the provider's messages API.     */
/* ------------------------------------------------------------------ */

export function createProvider(id: AIProviderId): AIProvider {
  switch (id) {
    case "anthropic":
      return anthropicProvider();
    case "openai":
    case "google":
      throw new Error(`${id} adapter: Sprint 2 TODO`);
  }
}

function anthropicProvider(): AIProvider {
  return {
    id: "anthropic",
    async complete(req) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", // cheap + fast: right tier for decorative text
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
      const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
      return data.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    },
  };
}
