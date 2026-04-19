# Aelisse — Acceptance Test Scenarios

These tests verify Aelisse works correctly. Both passed on April 15, 2026.
Re-run after significant changes to the pipeline.

---

## Test 1: Self-onboarding

**What it proves:** Aelisse can accurately describe a TypeScript/Bun codebase
with a multi-agent architecture. If she can read herself and produce accurate
context, she can read any similar codebase.

**Command:**
```bash
aelisse \
  --repo "$HOME/Documents/repos/aelisse" \
  --contexts "$HOME/Documents/repos/aelisse-contexts"
```

**Expected output — `aelisse-contexts/aelisse/context.md` must contain:**
- [ ] Project described as an autonomous agent system / co-engineer
- [ ] Stack correctly identified: Bun, TypeScript, @anthropic-ai/sdk, @modelcontextprotocol/sdk, zod
- [ ] Three subagents named: Explorer, Analyzer, Writer
- [ ] MCP filesystem server mentioned
- [ ] `src/orchestrator.ts` identified as the entry point
- [ ] Anti-Loop Protocol section present and correct
- [ ] Setup commands include `bun install` and `bun link`

**Expected output — `aelisse-contexts/aelisse/settings.json` must:**
- [ ] Allow `Bash(bun *)`
- [ ] Deny `Bash(rm -rf *)`
- [ ] Deny `Bash(git push * --force*)`
- [ ] Deny `Read(.env)`

**Expected output — `aelisse-contexts/aelisse/project-skills/` must contain:**
- [ ] At least one skill file
- [ ] Every SKILL.md has `detect_patterns` frontmatter
- [ ] Every SKILL.md has `## When to use this skill`, `## Steps`, `## Quality Checklist`

**Expected output — evals must pass:**
```bash
bun run eval aelisse
```
- [ ] ✓ context.md structure
- [ ] ✓ settings.json structure
- [ ] ✓ project-skills/ files

**Expected output — cost summary printed at the end:**
- [ ] Token counts displayed
- [ ] Estimated cost displayed in USD

**Failure conditions:**
- context.md describes a generic TypeScript project with no mention of agents or MCP
- Stack lists npm instead of bun
- No skill files generated
- Evals fail on any check

---

## Test 2: Silent Sentry

**What it proves:** Aelisse works accurately on a real production NestJS/Firebase
codebase she has never seen before.

**Command:**
```bash
aelisse \
  --repo "$HOME/Documents/repos/silent-sentry" \
  --contexts "$HOME/Documents/repos/aelisse-contexts"
```

**Expected output — `aelisse-contexts/silent-sentry/context.md` must contain:**
- [ ] Project described as an uptime monitoring system
- [ ] Cron job / scheduled pinging mentioned
- [ ] Discord notifications mentioned
- [ ] Client dashboard mentioned
- [ ] NestJS + Firebase identified as the stack
- [ ] Setup commands that actually work for this repo
- [ ] Anti-Loop Protocol section present

**Expected output — `aelisse-contexts/silent-sentry/rules/` must contain:**
- [ ] At least one domain-specific rules file (e.g. monitoring-domain.md)
- [ ] Every rules file has frontmatter with `paths:` scoping

**Expected output — `aelisse-contexts/silent-sentry/project-skills/` must contain:**
- [ ] A skill for adding a new monitored target
- [ ] A skill for adding a new notification channel
- [ ] Every SKILL.md references actual file paths from the SS codebase
- [ ] Every SKILL.md has `## When to use this skill`, `## Steps`, `## Quality Checklist`

**Expected output — `aelisse-contexts/silent-sentry/settings.json` must:**
- [ ] Allow the correct bash commands for SS's stack
- [ ] Deny `Bash(rm -rf *)`

**Expected output — `qa-features.yaml` must:**
- [ ] Features map to real SS functionality (health checks, targets, alerts)
- [ ] Evidence files point to real files in the repo

**Expected output — evals must pass:**
```bash
bun run eval silent-sentry
```
- [ ] ✓ context.md structure
- [ ] ✓ settings.json structure
- [ ] ✓ project-skills/ files

**Failure conditions:**
- context.md mentions Discord but not monitoring (partial understanding)
- Skill files reference files that don't exist in the repo (hallucination)
- context.md is generic — could describe any Node.js project
- Evals fail on any check

---

## Test 3: Orchestrator resolves a real ticket

**What it proves:** The full end-to-end workflow works — explore output is
accurate enough that the orchestrator can resolve a real ticket without
asking clarifying questions.

**Setup:** Silent Sentry must be onboarded first (Test 2 passed).

**Steps:**
1. Open aelisse in the SS repo:
```bash
cd "$HOME/Documents/repos/silent-sentry"
aelisse
```

2. Give the orchestrator a real GitHub issue:
```
@orchestrator take issue #<number> and propose a solution plan
```

3. Review the plan — it must:
- [ ] Correctly identify the affected files
- [ ] Propose a technically accurate fix
- [ ] Not ask where things live (the context told it)

4. Approve the plan and let it implement.

5. Verify:
- [ ] Implementation is correct
- [ ] PR was opened on GitHub
- [ ] Code-reviewer ran and reported findings (or confirmed clean)

**Failure conditions:**
- Orchestrator asks "where is the monitoring logic?" — context is incomplete
- Plan proposes changes to the wrong files
- PR not opened after approval

---

## How to run

```bash
# Test 1 — self-onboarding
aelisse --repo "$HOME/Documents/repos/aelisse" \
        --contexts "$HOME/Documents/repos/aelisse-contexts"
bun run eval aelisse

# Test 2 — Silent Sentry
aelisse --repo "$HOME/Documents/repos/silent-sentry" \
        --contexts "$HOME/Documents/repos/aelisse-contexts"
bun run eval silent-sentry

# Test 3 — resolve a ticket (manual)
cd "$HOME/Documents/repos/silent-sentry"
aelisse
# then: @orchestrator take issue #<number> and propose a solution plan
```

## Definition of done

All three tests pass.
The orchestrator resolves a real ticket without asking where things live.
Evals report all green on both repos.
Cost summary printed after every explore run.