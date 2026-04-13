# Aelisse

**Autonomous Engineering Lifecycle Intelligence: Systems Executor**

Aelisse is a personal AI co-engineer. She onboards herself into any codebase autonomously — exploring the repository, synthesizing what she finds, and generating a full project intelligence structure that makes future agent sessions immediately productive. Once onboarded, she operates as a permanent engineering presence across all your projects.

## What she does

Point Aelisse at any repo and she:

1. **Explores** — reads the codebase intelligently, inferring stack, conventions, patterns, and architecture
2. **Analyzes** — synthesizes findings into a complete project intelligence structure
3. **Writes** — generates `context.md`, scoped permission configs, path-aware rule files, and skill libraries with pattern detection

The output lives in a separate [`aelisse-contexts`](https://github.com/ficazam/aelisse-contexts) repo, versioned independently from the codebases it describes.

## Architecture

Three specialized subagents coordinated by an orchestrator, connected via a custom MCP filesystem server:

```
/explore (slash command)
        ↓
   ORCHESTRATOR
   plans, delegates, never touches files
        ↓              ↓              ↓
   EXPLORER        ANALYZER        WRITER
   reads repo      synthesizes     writes to
   → JSON report   → file content  aelisse-contexts/
        ↓              ↓              ↓
        MCP FILESYSTEM SERVER
        read tools    read tools    write tools
        only          only          only
```

Each subagent receives only the tools it needs — minimal footprint by design.

## Output structure

```
aelisse-contexts/
  [project-name]/
    context.md                  — full project intelligence
    settings.json               — scoped permissions inferred from stack
    qa-features.yaml            — testable features (if tests detected)
    ui-explorer-config.yaml     — UI crawler config (if frontend detected)
    rules/
      [domain].md               — path-scoped conventions per domain
    project-skills/
      [skill-name]/
        SKILL.md                — step-by-step skill with detect_patterns
```

## Installation

```bash
git clone https://github.com/ficazam/aelisse
cd aelisse
bun install
bun link
```

Add your API key:

```bash
echo "ANTHROPIC_API_KEY=your-key-here" > .env
```

## Usage

### Explore an existing repo

```bash
aelisse --repo /path/to/repo --contexts /path/to/aelisse-contexts
```

### Greenfield project

```bash
aelisse --greenfield \
  --name "my-saas" \
  --description "A Next.js SaaS with Stripe billing and Resend email" \
  --contexts /path/to/aelisse-contexts
```

### Via Claude Code slash command

```bash
cd /path/to/any-repo
aelisse    # launch your personal Claude Code instance
/explore   # triggers the full pipeline against the current directory
```

## Claude Code integration

Add to your `~/.aelisse/skills/explore/SKILL.md` (or equivalent config dir):

```yaml
---
name: explore
description: Onboard Aelisse into any codebase.
disable-model-invocation: true
allowed-tools: Bash(aelisse *)
---
```

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Anthropic SDK:** `@anthropic-ai/sdk`
- **Validation:** Zod

## Evals

Aelisse validates her own output after every run:

```bash
bun run evals/index.ts /path/to/aelisse-contexts [project-name]
```

Checks:
- `context.md` contains required sections including Anti-Loop Protocol
- `settings.json` has correct allow/deny permission structure
- Every `SKILL.md` has frontmatter, detect_patterns, and a quality checklist

## Self-onboarding

Aelisse can onboard herself:

```bash
aelisse --repo /path/to/aelisse --contexts /path/to/aelisse-contexts
```

If the output accurately describes a three-subagent orchestration system with
an MCP filesystem server — it works.

## Motivation

Built as a personal alternative to the agent infrastructure I work with
professionally. The goal: a reusable system that makes any codebase
agent-ready in minutes, without manual context writing.

Modeled on production agent infrastructure. Tested against real codebases.

---

*Aelisse — because your agents shouldn't start blind.*