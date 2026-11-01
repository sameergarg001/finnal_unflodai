export interface GenerateRequest {
  system: string;
  prompt: string;
  /** Ask the provider to return JSON only. */
  json?: boolean;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  /** "<provider>:<model>", stored on generated records for auditing. */
  modelVersion: string;
}

/** Every AI provider implements this. Swap providers via AI_PROVIDER. */
export interface AiProvider {
  name: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

export class AiError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AiError";
  }
}
