# Aelisse — Acceptance Test Scenarios

These are the two tests that prove Aelisse works.
Run them in order. Both must pass before the capstone is complete.

---

## Test 1: Self-onboarding

**What it proves:** Aelisse can accurately describe a TypeScript/Bun codebase
with a multi-agent architecture. If she can read herself and produce accurate
context, she can read any similar codebase.

**Command:**
```bash
aelisse \
  --repo ~/Documents/repos/aelisse \
  --contexts ~/Documents/repos/aelisse-contexts
```

**Expected output — `aelisse-contexts/aelisse/context.md` must contain:**
- [ ] Project described as an autonomous agent system / co-engineer
- [ ] Stack correctly identified: Bun, TypeScript, @anthropic-ai/sdk, @modelcontextprotocol/sdk, zod
- [ ] Three subagents named: Explorer, Analyzer, Writer
- [ ] MCP filesystem server mentioned with correct tool count (5 tools)
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
- [ ] Every SKILL.md has a Quality Checklist section

**Expected output — evals must pass:**
```bash
bun run evals/index.ts ~/Documents/repos/aelisse-contexts aelisse
```
- [ ] ✓ context.md structure
- [ ] ✓ settings.json structure
- [ ] ✓ project-skills/ files

**Failure conditions that mean something is wrong:**
- context.md describes a generic TypeScript project with no mention of agents or MCP
- Stack lists npm instead of bun
- No skill files generated (Aelisse's patterns should be detectable)
- Evals fail on any check

---

## Test 2: Silent Sentry

**What it proves:** Aelisse works on a real production codebase she has never
seen before. If the output accurately describes Silent Sentry without any
hand-holding, the system is production-ready.

**Command:**
```bash
aelisse \
  --repo ~/Documents/repos/silent-sentry \
  --contexts ~/Documents/repos/aelisse-contexts
```

**Expected output — `aelisse-contexts/silent-sentry/context.md` must contain:**
- [ ] Project described as an uptime monitoring system
- [ ] Cron job / scheduled pinging mentioned
- [ ] Discord notifications mentioned
- [ ] Client dashboard mentioned
- [ ] Stack correctly identified (whatever SS actually uses)
- [ ] Setup commands that actually work for this repo
- [ ] Anti-Loop Protocol section present

**Expected output — `aelisse-contexts/silent-sentry/project-skills/` must contain:**
- [ ] A skill for adding a new monitored project/endpoint
- [ ] A skill for adding a new notification type OR Discord integration
- [ ] Every SKILL.md references actual file paths from the SS codebase

**Expected output — `aelisse-contexts/silent-sentry/settings.json` must:**
- [ ] Allow the correct bash commands for SS's stack
- [ ] Not allow commands that don't apply to SS

**If `qa-features.yaml` is generated:**
- [ ] Features map to real SS functionality (monitoring, dashboard, notifications)
- [ ] Evidence files point to real files in the repo

**Expected output — evals must pass:**
```bash
bun run evals/index.ts ~/Documents/repos/aelisse-contexts silent-sentry
```
- [ ] ✓ context.md structure
- [ ] ✓ settings.json structure
- [ ] ✓ project-skills/ files

**Failure conditions that mean something is wrong:**
- context.md mentions Discord but not monitoring (partial understanding)
- Skill files reference files that don't exist in the repo (hallucination)
- context.md is generic — could describe any Node.js project
- Setup commands don't match what SS actually uses
- Evals fail on any check

---

## How to run both tests

```bash
# Test 1
aelisse --repo ~/Documents/repos/aelisse \
        --contexts ~/Documents/repos/aelisse-contexts
bun run evals/index.ts ~/Documents/repos/aelisse-contexts aelisse

# Test 2
aelisse --repo ~/Documents/repos/silent-sentry \
        --contexts ~/Documents/repos/aelisse-contexts
bun run evals/index.ts ~/Documents/repos/aelisse-contexts silent-sentry
```

## Definition of done

Both test scenarios pass all checklist items.
Both eval suites report all green.
The context files are accurate enough that a fresh Claude Code session,
given only the context.md, could resolve a real ticket in that repo
without asking clarifying questions.

That last condition is the real test. Run a ticket after the context
is generated and see if the agent needs to ask where things live.
If it doesn't — Aelisse works.