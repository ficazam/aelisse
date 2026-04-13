import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import Anthropic from "@anthropic-ai/sdk";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Singleton MCP client ───────────────────────────────────────────────────
// One client, one server process, shared across all subagents.

let mcpClient: Client | null = null;
let allTools: Anthropic.Tool[] = [];

export const initMcpClient = async (): Promise<void> => {
  const transport = new StdioClientTransport({
    command: "bun",
    args: [path.join(__dirname, "server.ts")],
  });

  mcpClient = new Client(
    { name: "aelisse-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);

  const { tools: mcpTools } = await mcpClient.listTools();
  allTools = mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: tool.inputSchema as Anthropic.Tool["input_schema"],
  }));

  console.error(`MCP connected. Tools: ${allTools.map((t) => t.name).join(", ")}`);
};

export const closeMcpClient = async (): Promise<void> => {
  await mcpClient?.close();
};

// ── Tool filtering per subagent role ──────────────────────────────────────
// Each subagent only sees the tools it's allowed to use.
// This is the minimal footprint principle from lesson 7 in practice.

export const getToolsForAgent = (allowedToolNames: string[]): Anthropic.Tool[] =>
  allTools.filter((t) => allowedToolNames.includes(t.name));

// ── Tool execution ────────────────────────────────────────────────────────

export const callTool = async (
  name: string,
  input: Record<string, unknown>
): Promise<string> => {
  if (!mcpClient) throw new Error("MCP client not initialized");

  const result = (await mcpClient.callTool({
    name,
    arguments: input,
  })) as CallToolResult;

  if (result.isError) {
    return result.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }

  return result.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
};