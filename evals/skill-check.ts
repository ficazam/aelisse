import * as fs from "fs";
import * as path from "path";
import type { EvalResult } from "./output-check.js";

const checkSingleSkill = (skillDir: string, skillName: string): string[] => {
  const failures: string[] = [];
  const skillPath = path.join(skillDir, "SKILL.md");

  if (!fs.existsSync(skillPath)) {
    return [`project-skills/${skillName}/SKILL.md missing`];
  }

  const content = fs.readFileSync(skillPath, "utf-8");

  if (!content.startsWith("---")) {
    failures.push(`project-skills/${skillName}/SKILL.md missing frontmatter`);
  }

  const requiredFrontmatterFields = [
    "name:",
    "description:",
    "target_subagents:",
    "category:",
    "paths:",
  ];

  for (const field of requiredFrontmatterFields) {
    if (!content.includes(field)) {
      failures.push(`project-skills/${skillName}/SKILL.md missing frontmatter field: ${field}`);
    }
  }

  const requiredSections = [
    "## When to use this skill",
    "## Steps",
    "## Quality Checklist",
  ];

  for (const section of requiredSections) {
    if (!content.includes(section)) {
      failures.push(`project-skills/${skillName}/SKILL.md missing section: ${section}`);
    }
  }

  const validSubagents = [
    "frontend-engineer",
    "backend-engineer",
    "qa-engineer",
    "devops-engineer",
    "review-engineer",
    "technical-writer",
  ];

  const hasValidSubagent = validSubagents.some((s) => content.includes(s));
  if (!hasValidSubagent) {
    failures.push(`project-skills/${skillName}/SKILL.md has no valid target_subagent`);
  }

  return failures;
};

export const checkSkillsDir = (projectDir: string): EvalResult => {
  const failures: string[] = [];
  const skillsDir = path.join(projectDir, "project-skills");

  if (!fs.existsSync(skillsDir)) {
    return { passed: false, failures: ["project-skills/ directory missing"] };
  }

  const skillDirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  if (skillDirs.length === 0) {
    failures.push("project-skills/ has no skill directories");
  }

  for (const skillName of skillDirs) {
    const skillDir = path.join(skillsDir, skillName);
    const skillFailures = checkSingleSkill(skillDir, skillName);
    failures.push(...skillFailures);
  }

  return { passed: failures.length === 0, failures };
};