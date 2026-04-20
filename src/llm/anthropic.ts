import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMClient,
  CompletionParams,
  CompletionResponse,
  ContentBlock,
  StopReason,
} from "./types.js";

export class AnthropicClient implements LLMClient {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      system: params.system,
      tools: params.tools as Anthropic.Tool[] | undefined,
      messages: params.messages as Anthropic.MessageParam[],
    });

    return {
      content: response.content as ContentBlock[],
      stop_reason: response.stop_reason as StopReason,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}
