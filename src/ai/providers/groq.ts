import { AiError, type AiProvider, type GenerateRequest, type GenerateResult } from "../types";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 45_000;

interface GroqResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string };
  model?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Groq (free tier, very fast) via its REST chat-completions endpoint.
 * The free tier has a per-minute token limit; on a 429 we wait briefly and
 * retry, then fall back to a smaller model that has its own limit.
 */
export function createGroqProvider(apiKey: string, model: string, fallbackModel?: string): AiProvider {
  async function call(m: string, req: GenerateRequest) {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: AbortSignal.timeout(req.timeoutMs ?? TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: m,
        temperature: req.temperature ?? 0.7,
        // gpt-oss models reason before answering; "low" keeps replies fast and within free limits.
        ...(m.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: req.json ? `${req.system}\n\nReply with a single valid JSON object only.` : req.system },
          { role: "user", content: req.prompt },
        ],
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as GroqResponse;
    return { res, body };
  }

  return {
    name: "groq",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const models = [model, ...(fallbackModel && fallbackModel !== model ? [fallbackModel] : [])];
      let lastError = "";
      for (const m of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const { res, body } = await call(m, req);
          if (res.ok) {
            const text = body.choices?.[0]?.message?.content?.trim() ?? "";
            if (!text) throw new AiError("Groq returned an empty response");
            return { text, modelVersion: `groq:${body.model ?? m}` };
          }
          lastError = `Groq ${res.status}: ${body.error?.message ?? res.statusText}`;
          if (res.status !== 429) throw new AiError(lastError);
          // Rate limited: wait if it's short, otherwise try the fallback model.
          const wait = Number(/try again in ([\d.]+)s/.exec(body.error?.message ?? "")?.[1] ?? NaN);
          if (attempt === 0 && Number.isFinite(wait) && wait <= 6) await sleep(wait * 1000 + 250);
          else break;
        }
      }
      throw new AiError(lastError || "Groq request failed");
    },
  };
}
