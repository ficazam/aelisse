import Anthropic from "@anthropic-ai/sdk";
import * as path from "path";
import {
  initMcpClient,
  closeMcpClient,
  getToolsForAgent,
  callTool,
} from "./mcp/client.js";
import { EXPLORER_SYSTEM_PROMPT } from "./agents/explorer.js";
import { ANALYZER_SYSTEM_PROMPT } from "./agents/analyzer.js";
import { WRITER_SYSTEM_PROMPT } from "./agents/writer.js";
import { PLANNER_SYSTEM_PROMPT } from "./agents/planner.js";
import { execSync } from "child_process";
import { checkContextMd } from "../evals/output-check.js";
import { checkSettingsJson } from "../evals/settings-check.js";
import { checkSkillsDir } from "../evals/skill-check.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Cost tracking ──────────────────────────────────────────────────────────

type UsageAccumulator = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

const usage: UsageAccumulator = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

const COST_PER_MILLION_INPUT = 3.0; // claude-sonnet-4-6
const COST_PER_MILLION_OUTPUT = 15.0;
const COST_PER_MILLION_CACHE_READ = 0.3;
const COST_PER_MILLION_CACHE_WRITE = 3.75;

const estimateCost = (u: UsageAccumulator): number =>
  (u.inputTokens / 1_000_000) * COST_PER_MILLION_INPUT +
  (u.outputTokens / 1_000_000) * COST_PER_MILLION_OUTPUT +
  (u.cacheReadTokens / 1_000_000) * COST_PER_MILLION_CACHE_READ +
  (u.cacheWriteTokens / 1_000_000) * COST_PER_MILLION_CACHE_WRITE;

// ── Subagent runner ────────────────────────────────────────────────────────

const runSubagent = async (
  systemPrompt: string,
  task: string,
  allowedTools: string[],
  maxTokens = 8192
): Promise<string> => {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];

  const tools = getToolsForAgent(allowedTools);
  const MAX_ITERATIONS = 20;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6", // was claude-opus-4-5
      max_tokens: maxTokens,
      system: systemPrompt,
      tools,
      messages,
    });

    // accumulate token usage across all subagent calls
    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
    usage.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => ({
        type: "tool_result" as const,
        tool_use_id: toolUse.id,
        content: await callTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
        ),
      })),
    );

    messages.push({ role: "user", content: toolResults });
  }

  return `Error: subagent hit max iterations (${MAX_ITERATIONS})`;
};

// ── Phase runners ──────────────────────────────────────────────────────────

const runExplorer = async (repoPath: string): Promise<string> =>
  runSubagent(
    EXPLORER_SYSTEM_PROMPT,
    `Explore this repository and produce the structured JSON report.
     Repository path: ${repoPath}`,
    ["get_repo_context", "read_file", "list_files", "search_files"],
  );

const runPlanner = async (
  projectName: string,
  description: string,
): Promise<string> =>
  runSubagent(
    PLANNER_SYSTEM_PROMPT,
    `Project name: ${projectName}
     Description: ${description}
     
     Produce the ExplorerReport JSON for this greenfield project.`,
    [], // planner needs no tools — it reasons from description alone
  );

const runAnalyzer = async (
  explorerReport: string,
  repoPath: string,
): Promise<string> =>
  runSubagent(
    ANALYZER_SYSTEM_PROMPT,
    `Analyze this explorer report and produce the full AnalyzerOutput JSON.
     Repository path (for targeted re-reads only): ${repoPath}
     
     Explorer report:
     ${explorerReport}`,
    ["read_file"],
    16000
  );

const runWriter = async (
  analyzerOutput: string,
  contextsRepoPath: string,
  projectName: string,
): Promise<string> =>
  runSubagent(
    WRITER_SYSTEM_PROMPT,
    `Write all context files from this AnalyzerOutput.
     aelisse-contexts repo path: ${contextsRepoPath}
     Project name: ${projectName}
     
     AnalyzerOutput:
     ${analyzerOutput}`,
    ["write_context_file"],
  );

// ── Orchestrators ──────────────────────────────────────────────────────────

export const runOrchestrator = async (
  repoPath: string,
  contextsRepoPath: string,
): Promise<void> => {
  await initMcpClient();

  try {
    const projectName = path.basename(repoPath);
    console.log(`\nAelisse — exploring ${projectName}\n`);

    console.log("Phase 1: Exploring codebase...");
    const explorerReport = await runExplorer(repoPath);

    console.log("Phase 2: Analyzing findings...");
    const analyzerOutput = await runAnalyzer(explorerReport, repoPath);

    console.log("Phase 3: Writing context files...");
    const manifest = await runWriter(
      analyzerOutput,
      contextsRepoPath,
      projectName,
    );

    console.log(`\nAelisse — ${projectName} is ready\n`);
    console.log(manifest);

    // ── Phase 4: Evals ──────────────────────────────────────────────────
    console.log("\nPhase 4: Running evals...");
    const projectDir = path.join(contextsRepoPath, projectName);
    const results = [
      { name: "context.md structure", result: checkContextMd(projectDir) },
      {
        name: "settings.json structure",
        result: checkSettingsJson(projectDir),
      },
      { name: "project-skills/ files", result: checkSkillsDir(projectDir) },
    ];

    let allPassed = true;
    for (const { name, result } of results) {
      if (result.passed) {
        console.log(`  ✓ ${name}`);
      } else {
        allPassed = false;
        console.error(`  ✗ ${name}`);
        for (const failure of result.failures) {
          console.error(`      → ${failure}`);
        }
      }
    }

    if (!allPassed) {
      console.error("\nEvals failed — context may be incomplete.");
    }

    // ── Phase 5: Auto-commit ────────────────────────────────────────────
    console.log("\nPhase 5: Committing context...");
    try {
      execSync(`git -C "${contextsRepoPath}" add .`, { stdio: "pipe" });
      execSync(
        `git -C "${contextsRepoPath}" commit -m "explore: ${projectName} context (via /explore)"`,
        { stdio: "pipe" },
      );
      console.log(`  ✓ committed to aelisse-contexts`);
    } catch {
      console.log("  — nothing to commit (context unchanged)");
    }

    // ── Phase 6: Cost summary ───────────────────────────────────────────
    const totalCost = estimateCost(usage);
    console.log("\nPhase 6: Cost summary");
    console.log(`  input tokens:       ${usage.inputTokens.toLocaleString()}`);
    console.log(`  output tokens:      ${usage.outputTokens.toLocaleString()}`);
    console.log(
      `  cache read tokens:  ${usage.cacheReadTokens.toLocaleString()}`,
    );
    console.log(
      `  cache write tokens: ${usage.cacheWriteTokens.toLocaleString()}`,
    );
    console.log(`  estimated cost:     $${totalCost.toFixed(4)}`);
  } finally {
    await closeMcpClient();
  }
};

export const runGreenfieldOrchestrator = async (
  projectName: string,
  description: string,
  contextsRepoPath: string,
): Promise<void> => {
  await initMcpClient();

  try {
    console.log(`\nAelisse — planning ${projectName} (greenfield)\n`);

    console.log("Phase 1: Planning project structure...");
    const plannerReport = await runPlanner(projectName, description);

    console.log("Phase 2: Analyzing plan...");
    const analyzerOutput = await runAnalyzer(plannerReport, "");

    console.log("Phase 3: Writing context files...");
    const manifest = await runWriter(
      analyzerOutput,
      contextsRepoPath,
      projectName,
    );

    console.log(`\nAelisse — ${projectName} is ready\n`);
    console.log(manifest);

    // ── Phase 4: Evals ──────────────────────────────────────────────────
    console.log("\nPhase 4: Running evals...");
    const projectDir = path.join(contextsRepoPath, projectName);
    const results = [
      { name: "context.md structure", result: checkContextMd(projectDir) },
      {
        name: "settings.json structure",
        result: checkSettingsJson(projectDir),
      },
      { name: "project-skills/ files", result: checkSkillsDir(projectDir) },
    ];

    let allPassed = true;
    for (const { name, result } of results) {
      if (result.passed) {
        console.log(`  ✓ ${name}`);
      } else {
        allPassed = false;
        console.error(`  ✗ ${name}`);
        for (const failure of result.failures) {
          console.error(`      → ${failure}`);
        }
      }
    }

    if (!allPassed) {
      console.error("\nEvals failed — context may be incomplete.");
    }

    // ── Phase 5: Auto-commit ────────────────────────────────────────────
    console.log("\nPhase 5: Committing context...");
    try {
      execSync(`git -C "${contextsRepoPath}" add .`, { stdio: "pipe" });
      execSync(
        `git -C "${contextsRepoPath}" commit -m "explore: ${projectName} context (greenfield)"`,
        { stdio: "pipe" },
      );
      console.log(`  ✓ committed to aelisse-contexts`);
    } catch {
      console.log("  — nothing to commit (context unchanged)");
    }

    // ── Phase 6: Cost summary ───────────────────────────────────────────
    const totalCost = estimateCost(usage);
    console.log("\nPhase 6: Cost summary");
    console.log(`  input tokens:       ${usage.inputTokens.toLocaleString()}`);
    console.log(`  output tokens:      ${usage.outputTokens.toLocaleString()}`);
    console.log(
      `  cache read tokens:  ${usage.cacheReadTokens.toLocaleString()}`,
    );
    console.log(
      `  cache write tokens: ${usage.cacheWriteTokens.toLocaleString()}`,
    );
    console.log(`  estimated cost:     $${totalCost.toFixed(4)}`);
  } finally {
    await closeMcpClient();
  }
};

// ── CLI entry point ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const repoFlag = args.indexOf("--repo");
const contextsFlag = args.indexOf("--contexts");
const greenfieldFlag = args.indexOf("--greenfield");
const nameFlag = args.indexOf("--name");
const descFlag = args.indexOf("--description");

if (contextsFlag === -1) {
  console.error("Error: --contexts is required");
  console.error(
    "Usage: aelisse --repo <path> --contexts <path>\n" +
      "       aelisse --greenfield --name <name> --description <desc> --contexts <path>",
  );
  process.exit(1);
}

const contextsPath = args[contextsFlag + 1];

if (!contextsPath) {
  console.error("Error: --contexts requires a path");
  process.exit(1);
}

if (greenfieldFlag !== -1) {
  // greenfield mode
  const projectName = nameFlag !== -1 ? args[nameFlag + 1] : null;
  const description = descFlag !== -1 ? args[descFlag + 1] : null;

  if (!projectName || !description) {
    console.error(
      "Greenfield mode requires --name and --description\n" +
        'Example: aelisse --greenfield --name my-saas --description "A Next.js SaaS with auth and billing" --contexts <path>',
    );
    process.exit(1);
  }

  runGreenfieldOrchestrator(projectName, description, contextsPath).catch(
    (err) => {
      console.error("Fatal:", err);
      process.exit(1);
    },
  );
} else {
  // explore mode
  const repoPath = repoFlag !== -1 ? args[repoFlag + 1] : null;

  if (!repoPath) {
    console.error(
      "Explore mode requires --repo\n" +
        "Usage: aelisse --repo <path> --contexts <path>",
    );
    process.exit(1);
  }

  runOrchestrator(repoPath, contextsPath).catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
