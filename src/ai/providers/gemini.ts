import { AiError, type AiProvider, type GenerateRequest, type GenerateResult } from "../types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const TIMEOUT_MS = 60_000;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

/** Google Gemini via REST (free tier). No SDK dependency. */
export function createGeminiProvider(apiKey: string, model: string): AiProvider {
  return {
    name: "gemini",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const res = await fetch(`${API_BASE}/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(req.timeoutMs ?? TIMEOUT_MS),
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.prompt }] }],
          generationConfig: {
            temperature: req.temperature ?? 0.7,
            ...(req.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      });

      const body = (await res.json().catch(() => ({}))) as GeminiResponse;
      if (!res.ok) {
        throw new AiError(`Gemini ${res.status}: ${body.error?.message ?? res.statusText}`);
      }
      if (body.promptFeedback?.blockReason) {
        throw new AiError(`Gemini blocked prompt: ${body.promptFeedback.blockReason}`);
      }

      const text = body.candidates?.[0]?.content?.parts
          ?.filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("") ?? "";
      if (!text) throw new AiError("Gemini returned an empty response");

      return { text, modelVersion: `gemini:${model}` };
    },
  };
}
