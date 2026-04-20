import type { LLMClient } from "./types";
import { AnthropicClient } from "./anthropic";
import { OllamaClient } from "./ollama";

export type {
  LLMClient,
  CompletionParams,
  CompletionResponse,
} from "./types.js";

// ── Provider factory ───────────────────────────────────────────────────────
//
// Configure via environment variables:
//s
//   LLM_PROVIDER=anthropic   (default)
//   LLM_PROVIDER=ollama
//
//   LLM_MODEL=claude-sonnet-4-6          (default for anthropic)
//   LLM_MODEL=qwen2.5-coder:14b          (example for ollama)
//
//   OLLAMA_BASE_URL=http://localhost:11434  (default)

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  ollama: "qwen2.5-coder:14b",
};

export const createLLMClient = (): LLMClient => {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";

  switch (provider) {
    case "anthropic":
      return new AnthropicClient();
    case "ollama":
      return new OllamaClient(
        process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      );
    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${provider}". Supported: anthropic, ollama`,
      );
  }
};

export const getModel = (): string =>
  process.env.LLM_MODEL ??
  DEFAULT_MODELS[process.env.LLM_PROVIDER ?? "anthropic"] ??
  "claude-sonnet-4-6";
