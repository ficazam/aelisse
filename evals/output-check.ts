import * as fs from "fs";
import * as path from "path";

export type EvalResult = {
  passed: boolean;
  failures: string[];
};

export const checkContextMd = (projectDir: string): EvalResult => {
  const failures: string[] = [];
  const filePath = path.join(projectDir, "context.md");

  if (!fs.existsSync(filePath)) {
    return { passed: false, failures: ["context.md missing"] };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const requiredSections = [
    "Project Overview",
    "Setup Commands",
    "Architecture",
    "Anti-Loop Protocol",
  ];

  for (const section of requiredSections) {
    if (!content.includes(section)) {
      failures.push(`context.md missing section: ${section}`);
    }
  }

  if (content.includes("best practices") || content.includes("generic")) {
    failures.push("context.md contains generic advice — must be codebase-specific");
  }

  return { passed: failures.length === 0, failures };
};