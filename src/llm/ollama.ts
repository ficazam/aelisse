import type {
  LLMClient,
  CompletionParams,
  CompletionResponse,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
} from "./types";

// Ollama tool call response shape
interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaResponse {
  message: OllamaMessage;
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaClient implements LLMClient {
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    // Convert messages to Ollama format
    const messages = [
      { role: "system", content: params.system },
      ...params.messages.map((m) => {
        if (typeof m.content === "string") {
          return { role: m.role, content: m.content };
        }
        // Flatten content blocks to string for Ollama
        const text = m.content
          .filter((b): b is TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        return { role: m.role, content: text };
      }),
    ];

    // Convert tools to Ollama format
    const tools = params.tools?.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      stream: false,
      options: { num_predict: params.max_tokens },
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as OllamaResponse;
    const content: ContentBlock[] = [];

    // Handle tool calls
    if (data.message.tool_calls && data.message.tool_calls.length > 0) {
      for (const tc of data.message.tool_calls) {
        const block: ToolUseBlock = {
          type: "tool_use",
          id: `ollama-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: tc.function.name,
          input: tc.function.arguments,
        };
        content.push(block);
      }
    }

    // Handle text response
    if (data.message.content) {
      content.push({ type: "text", text: data.message.content });
    }

    const stopReason =
      data.message.tool_calls && data.message.tool_calls.length > 0
        ? "tool_use"
        : "end_turn";

    return {
      content,
      stop_reason: stopReason,
      usage: {
        input_tokens: data.prompt_eval_count ?? 0,
        output_tokens: data.eval_count ?? 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    };
  }
}
