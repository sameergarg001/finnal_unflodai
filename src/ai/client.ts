import type { z } from "zod";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { AiError, type AiProvider, type GenerateRequest } from "./types";

let cached: AiProvider | null = null;

/** Returns the configured provider, or null if no API key is set. */
export function getAiProvider(): AiProvider | null {
  if (cached) return cached;
  // Default: whichever key is set — Claude (paid), then Groq (free, fast), then Gemini (free).
  const provider =
    process.env.AI_PROVIDER ||
    (process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.GROQ_API_KEY ? "groq" : "gemini");

  switch (provider) {
    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return null;
      cached = createAnthropicProvider(key, process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5");
      return cached;
    }
    case "groq": {
      const key = process.env.GROQ_API_KEY;
      if (!key) return null;
      cached = createGroqProvider(key, process.env.GROQ_MODEL || "llama-3.3-70b-versatile");
      return cached;
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return null;
      cached = createGeminiProvider(key, process.env.GEMINI_MODEL ?? "gemini-3.8-flash");
      return cached;
    }
    default:
      throw new AiError(`Unknown AI_PROVIDER "${provider}"`);
  }
}

/**
 * Ask the model for JSON and validate it against a Zod schema.
 * Retries once on invalid output. Callers should catch AiError and fall back
 * to non-AI behaviour (e.g. a pre-written challenge).
 */
export async function generateStructured<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  req: Omit<GenerateRequest, "json">,
): Promise<{ data: T; modelVersion: string }> {
  const provider = getAiProvider();
  if (!provider) throw new AiError("No AI provider configured (set GROQ_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY)");

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, modelVersion } = await provider.generate({ ...req, json: true });
    try {
      const parsed = schema.safeParse(JSON.parse(stripFences(text)));
      if (parsed.success) return { data: parsed.data, modelVersion };
      lastError = parsed.error;
    } catch (e) {
      lastError = e;
    }
  }
  throw new AiError("AI returned invalid structured output", lastError);
}

/** Plain-text generation (used by the mentor chat). */
export async function generateText(req: Omit<GenerateRequest, "json">): Promise<{ text: string; modelVersion: string }> {
  const provider = getAiProvider();
  if (!provider) throw new AiError("No AI provider configured (set GROQ_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY)");
  const { text, modelVersion } = await provider.generate(req);
  return { text: text.trim(), modelVersion };
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
