import { AiError, type AiProvider, type GenerateRequest, type GenerateResult } from "../types";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 45_000;

interface GroqResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string };
  model?: string;
}

/** Groq (free tier, very fast) via its REST chat-completions endpoint. */
export function createGroqProvider(apiKey: string, model: string): AiProvider {
  return {
    name: "groq",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const res = await fetch(API_URL, {
        method: "POST",
        signal: AbortSignal.timeout(req.timeoutMs ?? TIMEOUT_MS),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: req.temperature ?? 0.7,
          messages: [
            { role: "system", content: req.json ? `${req.system}\n\nReply with a single valid JSON object only.` : req.system },
            { role: "user", content: req.prompt },
          ],
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as GroqResponse;
      if (!res.ok) throw new AiError(`Groq ${res.status}: ${body.error?.message ?? res.statusText}`);
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new AiError("Groq returned an empty response");
      return { text, modelVersion: `groq:${body.model ?? model}` };
    },
  };
}
