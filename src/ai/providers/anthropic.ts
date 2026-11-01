import Anthropic from "@anthropic-ai/sdk";
import { AiError, type AiProvider, type GenerateRequest, type GenerateResult } from "../types";

const TIMEOUT_MS = 60_000;

/**
 * Claude via the official Anthropic SDK. Runs server-side only — the key never
 * reaches the browser. Coaching replies are short, so effort stays "low" for
 * speed; set ANTHROPIC_EFFORT to trade speed for depth.
 */
export function createAnthropicProvider(apiKey: string, model: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const effort = (process.env.ANTHROPIC_EFFORT ?? "low") as "low" | "medium" | "high";

  return {
    name: "anthropic",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const system = req.json
        ? `${req.system}\n\nReply with a single valid JSON object only — no prose, no code fences.`
        : req.system;

      let response;
      try {
        response = await client.beta.messages.create(
          {
            model,
            max_tokens: 16000,
            system,
            messages: [{ role: "user", content: req.prompt }],
            output_config: { effort },
            // If Claude declines a request, the API retries it on a fallback model.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          { timeout: req.timeoutMs ?? TIMEOUT_MS },
        );
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) throw new AiError("Claude: invalid ANTHROPIC_API_KEY", e);
        if (e instanceof Anthropic.RateLimitError) throw new AiError("Claude: rate limited", e);
        if (e instanceof Anthropic.APIError) throw new AiError(`Claude ${e.status}: ${e.message}`, e);
        throw new AiError(`Claude request failed: ${(e as Error).message}`, e);
      }

      if (response.stop_reason === "refusal") throw new AiError("Claude declined this request");
      const text = response.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      if (!text) throw new AiError("Claude returned an empty response");
      return { text, modelVersion: `anthropic:${response.model}` };
    },
  };
}
