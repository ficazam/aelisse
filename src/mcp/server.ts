import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const server = new McpServer({
  name: "aelisse-filesystem",
  version: "1.0.0",
});

// ── Read tools ────────────────────────────────────────────────────────────────

server.registerTool(
  "get_repo_context",
  {
    title: "Get Repo Context",
    description:
      "Returns package.json, top-level directory structure, and README in one call. " +
      "Always call this first — it gives the broadest orientation with minimum tool calls.",
    inputSchema: {
      rootDir: z.string().describe("Absolute path to repo root"),
    },
  },
  async ({ rootDir }) => {
    const result: Record<string, unknown> = {};

    const pkgPath = path.join(rootDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      result.packageJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    }

    const cargotomlPath = path.join(rootDir, "Cargo.toml");
    if (fs.existsSync(cargotomlPath)) {
      result.cargoToml = fs.readFileSync(cargotomlPath, "utf-8");
    }

    const pyprojectPath = path.join(rootDir, "pyproject.toml");
    if (fs.existsSync(pyprojectPath)) {
      result.pyprojectToml = fs.readFileSync(pyprojectPath, "utf-8");
    }

    result.structure = fs
      .readdirSync(rootDir)
      .filter(
        (f) =>
          !["node_modules", ".git", "dist", ".next", "__pycache__"].includes(f),
      )
      .join("\n");

    const readmePath = path.join(rootDir, "README.md");
    if (fs.existsSync(readmePath)) {
      result.readme = fs.readFileSync(readmePath, "utf-8").slice(0, 3000);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.registerTool(
  "read_file",
  {
    title: "Read File",
    description:
      "Read a file's contents. Use for source files, configs, and docs.",
    inputSchema: {
      path: z.string().describe("Absolute file path"),
    },
  },
  async ({ path: filePath }) => {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          content: [
            { type: "text", text: `Error: file not found at ${filePath}` },
          ],
        };
      }
      const MAX_CHARS = 40_000;
      const raw = fs.readFileSync(filePath, "utf-8");
      const text =
        raw.length > MAX_CHARS
          ? raw.slice(0, MAX_CHARS) +
            `\n\n[truncated — file is ${raw.length} chars, showing first ${MAX_CHARS}]`
          : raw;
      return {
        content: [{ type: "text", text }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "list_files",
  {
    title: "List Files",
    description:
      "List files in a directory. Use to understand structure before reading.",
    inputSchema: {
      directory: z.string().describe("Absolute directory path"),
      recursive: z
        .boolean()
        .optional()
        .describe("List recursively. Default false."),
    },
  },
  async ({ directory, recursive = false }) => {
    try {
      if (!fs.existsSync(directory)) {
        return {
          content: [{ type: "text", text: "Error: directory not found" }],
        };
      }

      if (recursive) {
        const files: string[] = [];
        const walk = (dir: string) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (
              entry.isDirectory() &&
              ![
                "node_modules",
                ".git",
                "dist",
                ".next",
                "__pycache__",
              ].includes(entry.name)
            ) {
              walk(fullPath);
            } else if (entry.isFile()) {
              files.push(fullPath.replace(directory + path.sep, ""));
            }
          }
        };
        walk(directory);
        return {
          content: [{ type: "text", text: files.join("\n") || "(empty)" }],
        };
      }

      const entries = fs
        .readdirSync(directory, { withFileTypes: true })
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      return {
        content: [{ type: "text", text: entries.join("\n") || "(empty)" }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "search_files",
  {
    title: "Search Files",
    description:
      "Search for a pattern across files in a directory. " +
      "Use to detect conventions (arrow functions, exports, imports) and patterns.",
    inputSchema: {
      directory: z.string().describe("Absolute directory path to search"),
      query: z.string().describe("String to search for"),
      fileExtension: z
        .string()
        .optional()
        .describe("Filter by extension, e.g. '.ts'"),
    },
  },
  async ({ directory, query, fileExtension }) => {
    try {
      const results: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (
            entry.isDirectory() &&
            !["node_modules", ".git", "dist", ".next", "__pycache__"].includes(
              entry.name,
            )
          ) {
            walk(fullPath);
          } else if (entry.isFile()) {
            if (fileExtension && !entry.name.endsWith(fileExtension)) continue;
            const lines = fs.readFileSync(fullPath, "utf-8").split("\n");
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line === undefined) continue;
              if (line.includes(query)) {
                results.push(
                  `${fullPath.replace(directory + path.sep, "")}:${i + 1}: ${line.trim()}`,
                );
              }
            }
          }
        }
      };
      walk(directory);

      const truncated = results.slice(0, 60);
      const output =
        truncated.length > 0
          ? truncated.join("\n") +
            (results.length > 60 ? `\n...${results.length - 60} more` : "")
          : `No matches for "${query}"`;

      return { content: [{ type: "text", text: output }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ── Write tools ───────────────────────────────────────────────────────────────

server.registerTool(
  "write_context_file",
  {
    title: "Write Context File",
    description:
      "Write a file to the aelisse-contexts repo. " +
      "Use only for writing generated context — never for modifying source repos.",
    inputSchema: {
      contextsRepoPath: z
        .string()
        .describe("Absolute path to aelisse-contexts repo"),
      projectName: z
        .string()
        .describe("Project name (becomes the directory name)"),
      relativePath: z
        .string()
        .describe(
          "Path relative to project root, e.g. 'rules/backend-patterns.md'",
        ),
      content: z.string().describe("File content to write"),
    },
  },
  async ({ contextsRepoPath, projectName, relativePath, content }) => {
    try {
      const fullPath = path.join(contextsRepoPath, projectName, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf-8");
      return {
        content: [
          {
            type: "text",
            text: `Written: ${path.join(projectName, relativePath)}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Aelisse filesystem server running");
