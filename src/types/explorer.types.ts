export type StackInfo = {
  language: string;
  runtime: string;
  framework: string | null;
  packageManager: string;
  majorDependencies: string[];
  testFramework: string | null;
  hasDocker: boolean;
  hasCI: boolean;
  ciPlatform: string | null;
};

export type StructureInfo = {
  topLevelDirs: string[];
  entryPoints: string[];
  testDirs: string[];
  configFiles: string[];
  hasFrontend: boolean;
  hasBackend: boolean;
  isMonorepo: boolean;
  subprojects: string[];
};

export type ConventionInfo = {
  usesArrowFunctions: boolean;
  usesDefaultExports: boolean;
  usesFunctionDeclarations: boolean;
  namingPattern: "camelCase" | "kebab-case" | "snake_case" | "mixed";
  hasBarrelExports: boolean;
  averageFileLengthEstimate: "small" | "medium" | "large";
  lintingTools: string[];
};

export type DetectedPattern = {
  name: string;
  description: string;
  evidence: string[];
  frequency: number;
  confidence: number;
};

export type TestableFeat = {
  slug: string;
  name: string;
  description: string;
  routes: string[];
  evidence: string[];
};

export type ExplorerReport = {
  projectName: string;
  stack: StackInfo;
  structure: StructureInfo;
  conventions: ConventionInfo;
  patterns: DetectedPattern[];
  testableFeatures: TestableFeat[];
  scripts: Record<string, string>;
  ports: Record<string, number>;
  protectedBranches: string[];
  notes: string[];
};