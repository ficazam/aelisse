# Aelisse — Autonomous Engineering Lifecycle Intelligence: Systems Executor

## What this is

Aelisse is a personal AI co-engineer. She onboards herself into any codebase
autonomously — exploring the repository, synthesizing what she finds, and
generating a full project intelligence structure that makes future agent
sessions immediately productive. Once onboarded, she operates as a permanent
engineering presence: resolving tickets, writing code, doing QA, and planning
refactors.

This repo is Aelisse's own codebase. She has onboarded herself into it.

## Architecture

Three subagents coordinated by an orchestrator, all connected to a shared
MCP filesystem server:

```
/aelisse:explore (slash command)
        ↓
ORCHESTRATOR (src/orchestrator.ts)
Plans, delegates, assembles manifest. Never touches files directly.
        ↓              ↓                    ↓
  EXPLORER         ANALYZER             WRITER
  (src/agents/     (src/agents/         (src/agents/
   explorer.ts)     analyzer.ts)         writer.ts)
  reads repo       synthesizes          writes to
  outputs JSON     outputs JSON         aelisse-contexts/
  report           file contents        [repo-name]/
        ↓              ↓                    ↓
        MCP FILESYSTEM SERVER (src/mcp/server.ts)
        Explorer/Analyzer: read tools only
        Writer: write_context_file only
```

Data flows in one direction: Explorer → Analyzer → Writer. No subagent
communicates with another directly — everything passes through the orchestrator.

## Stack

- Runtime: Bun
- Language: TypeScript (strict mode)
- MCP SDK: @modelcontextprotocol/sdk (use registerTool, never server.tool)
- Anthropic SDK: @anthropic-ai/sdk
- Validation: zod
- Package manager: Bun (never npm or yarn)
- Model: claude-opus-4-5 for all subagents

## Repository layout

```
aelisse/
  src/
    orchestrator.ts           — orchestrator loop + phase runners
    agents/
      explorer.ts             — EXPLORER_SYSTEM_PROMPT + explorer role
      analyzer.ts             — ANALYZER_SYSTEM_PROMPT + analyzer role
      writer.ts               — WRITER_SYSTEM_PROMPT + writer role
    mcp/
      server.ts               — MCP filesystem server (5 tools)
      client.ts               — singleton MCP client, tool filtering, callTool
    types/
      explorer.types.ts       — ExplorerReport type
      analyzer.types.ts       — AnalyzerOutput type
  evals/
    output-check.ts           — checkContextMd (exported)
    settings-check.ts         — checkSettingsJson (exported)
    skill-check.ts            — checkSkillsDir (exported)
    index.ts                  — CLI entry point, runs all three
  CLAUDE.md                   — this file
package.json
```

## MCP server tools

Five tools registered via registerTool on McpServer:

| Tool                | Access             | Description                                                                 |
|---------------------|--------------------|-----------------------------------------------------------------------------|
| get_repo_context    | Explorer           | Returns package.json, top-level structure, README in one call. Call first.  |
| read_file           | Explorer, Analyzer | Read a single file by absolute path                                         |
| list_files          | Explorer           | List directory contents, optionally recursive                               |
| search_files        | Explorer           | Search for a string across files, filter by extension                       |
| write_context_file  | Writer             | Write to aelisse-contexts/[project]/[path] only                             |

Tool access is enforced by getToolsForAgent() in client.ts — each subagent
only receives the tools it is allowed to use. This is the minimal footprint
principle: a subagent cannot do what it was not designed to do.

## Subagent roles

**Explorer** — reads the repo, outputs ExplorerReport JSON. No writing.
Exploration follows a fixed order defined in EXPLORER_SYSTEM_PROMPT.
Max 20 iterations.

**Analyzer** — receives ExplorerReport, outputs AnalyzerOutput JSON containing
the full content of every file to be written. May use read_file for targeted
re-reads. No writing. Only generates skills with confidence > 0.7.

**Writer** — receives AnalyzerOutput, writes every file to aelisse-contexts
using write_context_file. No reading. Outputs a manifest of files written.

## Output structure

Every /aelisse:explore run populates:

```
aelisse-contexts/
  [project-name]/
    context.md
    settings.json
    qa-features.yaml          (only if tests detected)
    ui-explorer-config.yaml   (only if frontend detected)
    rules/
      [domain].md             (path-scoped, only for detected domains)
    project-skills/
      [skill-name]/
        SKILL.md              (only if confidence > 0.7)
```

aelisse-contexts is a separate repo. Aelisse never writes into the
source repo she is exploring.

## Conventions

- Arrow functions everywhere. No function declarations.
- Named exports only. No default exports except where a framework requires it.
- One concern per file. No file should exceed 100 lines.
- Imports: external packages first, then internal by depth (types last).
- TypeScript strict mode is on. No any. No @ts-ignore without a comment.
- All errors are returned as strings, never thrown from tool handlers.
  Agents must be able to see errors and replan — an uncaught throw kills the loop.
- console.error only in MCP server (stdout is the protocol channel).
  console.log everywhere else for user-facing output.

## Critical rules

1. Never write to the source repo being explored. Only write to aelisse-contexts.
2. Never modify CLAUDE.md or files in project-skills/ or rules/ directly —
   these are generated outputs. Run /aelisse:explore to regenerate them.
3. The MCP server communicates over stdio. Never console.log in server.ts.
4. registerTool only — server.tool is deprecated and must never be used.
5. Each subagent runs in isolation. Do not share state between subagents
   outside of the string passed through the orchestrator.

## A task is not complete until

- `bun run src/orchestrator.ts` executes without errors
- `bun run evals/index.ts <contexts-path> <project>` passes all checks
- No file exceeds 100 lines
- TypeScript reports zero errors

## Running Aelisse

```bash
# Install dependencies
bun install

# Run against a repo
bun run src/orchestrator.ts --repo /path/to/repo --contexts /path/to/aelisse-contexts

# Run evals against output
bun run evals/index.ts /path/to/aelisse-contexts [project-name]

# Run MCP server standalone (for debugging)
bun run src/mcp/server.ts
```

## Skill files

Read these when the task requires them:

- .claude/project-skills/new-agent/SKILL.md      — adding a new subagent
- .claude/project-skills/new-mcp-tool/SKILL.md   — adding a tool to the MCP server
- .claude/project-skills/new-eval/SKILL.md       — adding a new eval check

## Anti-Loop Protocol

Max 3 retries for any failing operation. Same error twice → stop and analyze
root cause. After 3 failures, ask the user or document the blocker and move on.