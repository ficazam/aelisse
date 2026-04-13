export type Permission = {
  allow: string[];
  deny: string[];
};

export type RulesFile = {
  filename: string;
  paths: string[];
  content: string;
};

export type SkillFile = {
  name: string;
  description: string;
  targetSubagents: string[];
  category: "general" | "qa" | "backend" | "frontend" | "infrastructure";
  detectPatterns: string[];
  confidence: number;
  content: string;
};

export type AnalyzerOutput = {
  contextMd: string;
  settingsJson: { permissions: Permission };
  qaFeaturesYaml: string | null;
  uiExplorerConfigYaml: string | null;
  rules: RulesFile[];
  skills: SkillFile[];
};