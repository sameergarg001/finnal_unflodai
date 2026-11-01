import type { z } from "zod";
import { createGeminiProvider } from "./providers/gemini";
import { AiError, type AiProvider, type GenerateRequest } from "./types";

let cached: AiProvider | null = null;

/** Returns the configured provider, or null if no API key is set. */
export function getAiProvider(): AiProvider | null {
  if (cached) return cached;
  const provider = process.env.AI_PROVIDER ?? "gemini";

  switch (provider) {
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
  schema: z.ZodType<T>,
  req: Omit<GenerateRequest, "json">,
): Promise<{ data: T; modelVersion: string }> {
  const provider = getAiProvider();
  if (!provider) throw new AiError("No AI provider configured (set GEMINI_API_KEY)");

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
  if (!provider) throw new AiError("No AI provider configured (set GEMINI_API_KEY)");
  const { text, modelVersion } = await provider.generate(req);
  return { text: text.trim(), modelVersion };
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
