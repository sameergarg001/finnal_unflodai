import type { z } from "zod";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { AiError, type AiProvider, type GenerateRequest } from "./types";

let cached: AiProvider[] | null = null;

/**
 * Every configured provider, in order of preference. The first one is the
 * primary (AI_PROVIDER, or the first key found); the others are automatic
 * backups used when the primary is rate-limited, slow or down — so the user
 * gets a real AI answer instead of a scripted one.
 */
export function getAiProviders(): AiProvider[] {
  if (cached) return cached;
  const make: Record<string, () => AiProvider | null> = {
    anthropic: () => (process.env.ANTHROPIC_API_KEY ? createAnthropicProvider(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5") : null),
    groq: () =>
      process.env.GROQ_API_KEY
        ? createGroqProvider(process.env.GROQ_API_KEY, process.env.GROQ_MODEL || "openai/gpt-oss-120b", process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-20b")
        : null,
    gemini: () => (process.env.GEMINI_API_KEY ? createGeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || "gemini-3.8-flash") : null),
  };
  const preferred = process.env.AI_PROVIDER?.trim();
  if (preferred && !make[preferred]) throw new AiError(`Unknown AI_PROVIDER "${preferred}"`);
  const order = [...(preferred ? [preferred] : []), "anthropic", "groq", "gemini"].filter((v, i, a) => a.indexOf(v) === i);
  cached = order.map((name) => make[name]()).filter((p): p is AiProvider => p !== null);
  return cached;
}

/** The primary provider, or null if no API key is set. */
export function getAiProvider(): AiProvider | null {
  return getAiProviders()[0] ?? null;
}

/** Runs one request, failing over to the next provider on any error. */
async function generateWithFailover(req: GenerateRequest) {
  const providers = getAiProviders();
  if (!providers.length) throw new AiError("No AI provider configured (set GROQ_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY)");
  let lastError: unknown;
  for (const p of providers) {
    try {
      return await p.generate(req);
    } catch (e) {
      lastError = e;
      console.warn(`[ai] ${p.name} failed: ${(e as Error).message?.slice(0, 160)}`);
    }
  }
  throw lastError instanceof AiError ? lastError : new AiError("All AI providers failed", lastError);
}

/**
 * Ask the model for JSON and validate it against a Zod schema.
 * Retries once on invalid output (with the validation problem fed back).
 * Callers decide what happens on AiError — never invent an answer silently.
 */
export async function generateStructured<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  req: Omit<GenerateRequest, "json">,
): Promise<{ data: T; modelVersion: string }> {
  let lastError: unknown;
  let prompt = req.prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, modelVersion } = await generateWithFailover({ ...req, prompt, json: true });
    try {
      const parsed = schema.safeParse(JSON.parse(stripFences(text)));
      if (parsed.success) return { data: parsed.data, modelVersion };
      lastError = parsed.error;
      const issue = parsed.error.issues[0];
      console.warn(`[ai] invalid output (attempt ${attempt + 1}): ${issue.path.join(".")} — ${issue.message}`);
      prompt = `${req.prompt}\n\nYour previous JSON was invalid at "${issue.path.join(".")}": ${issue.message}. Return the full corrected JSON object.`;
    } catch (e) {
      lastError = e;
      prompt = `${req.prompt}\n\nYour previous reply was not valid JSON. Return one valid JSON object only.`;
    }
  }
  throw new AiError("AI returned invalid structured output", lastError);
}

/** Plain-text generation. */
export async function generateText(req: Omit<GenerateRequest, "json">): Promise<{ text: string; modelVersion: string }> {
  const { text, modelVersion } = await generateWithFailover(req);
  return { text: text.trim(), modelVersion };
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
