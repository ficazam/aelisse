import * as fs from "fs";
import * as path from "path";
import type { EvalResult } from "./output-check.js";

export const checkSettingsJson = (projectDir: string): EvalResult => {
  const failures: string[] = [];
  const filePath = path.join(projectDir, "settings.json");

  if (!fs.existsSync(filePath)) {
    return { passed: false, failures: ["settings.json missing"] };
  }

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { passed: false, failures: ["settings.json is not valid JSON"] };
  }

  const permissions = settings.permissions as Record<string, string[]> | undefined;

  if (!permissions?.allow) {
    failures.push("settings.json missing permissions.allow");
  }

  if (!permissions?.deny) {
    failures.push("settings.json missing permissions.deny");
  }

  const deny = permissions?.deny ?? [];
  const requiredDenies = ["rm -rf", "git push", "git reset --hard"];

  for (const required of requiredDenies) {
    if (!deny.some((d) => d.includes(required))) {
      failures.push(`settings.json missing deny rule for: ${required}`);
    }
  }

  const allow = permissions?.allow ?? [];
  const requiredAllows = ["git status", "git diff", "git log"];

  for (const required of requiredAllows) {
    if (!allow.some((a) => a.includes(required))) {
      failures.push(`settings.json missing allow rule for: ${required}`);
    }
  }

  return { passed: failures.length === 0, failures };
};