import * as path from "path";
import { checkContextMd } from "./output-check.js";
import { checkSettingsJson } from "./settings-check.js";
import { checkSkillsDir } from "./skill-check.js";
import type { EvalResult } from "./output-check.js";

const runAllEvals = (contextsRepoPath: string, projectName: string): void => {
  const projectDir = path.join(contextsRepoPath, projectName);

  const evals: { name: string; result: EvalResult }[] = [
    { name: "context.md structure", result: checkContextMd(projectDir) },
    { name: "settings.json structure", result: checkSettingsJson(projectDir) },
    { name: "project-skills/ files", result: checkSkillsDir(projectDir) },
  ];

  let allPassed = true;

  for (const { name, result } of evals) {
    if (result.passed) {
      console.log(`✓ ${name}`);
    } else {
      allPassed = false;
      console.error(`✗ ${name}`);
      for (const failure of result.failures) {
        console.error(`    → ${failure}`);
      }
    }
  }

  console.log(allPassed ? "\nAll evals passed." : "\nEvals failed.");
  process.exit(allPassed ? 0 : 1);
};

const [,, contextsPath, projectName] = process.argv;

if (!contextsPath || !projectName) {
  console.error(
    "Usage: bun run evals/index.ts <contexts-repo-path> <project-name>"
  );
  process.exit(1);
}

runAllEvals(contextsPath, projectName);