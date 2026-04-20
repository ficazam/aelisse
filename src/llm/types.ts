// ── LLM Provider Abstraction ───────────────────────────────────────────────
//
// Add a new provider by implementing LLMClient and registering it in index.ts.
// Supported providers: "anthropic" | "ollama"
// Set via LLM_PROVIDER env var. Defaults to "anthropic".

export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: MessageContent;
}

export type MessageContent =
  | string
  | ContentBlock[];

export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock;

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop";

export interface CompletionResponse {
  content: ContentBlock[];
  stop_reason: StopReason;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface CompletionParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Message[];
  tools?: Tool[];
}

export interface LLMClient {
  complete(params: CompletionParams): Promise<CompletionResponse>;
}
