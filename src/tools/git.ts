/**
 * Git-tier tools (read-only). A fourth tier mirroring the read-only git
 * helpers a client like ModelForge exposes. All are readOnlyHint: true and
 * never write, commit, or checkout. Backed by GitService, which uses argument
 * arrays (no shell injection) and confines every call to the vault root.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitService } from "../services/git.js";
import { ok, fail } from "../services/format.js";
import { ResponseFormat } from "../schemas/index.js";

const StatusInputSchema = z
  .object({
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' or 'json'"),
  })
  .strict();

const LogInputSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe("Number of recent commits to show (1-100, default 10)"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' or 'json'"),
  })
  .strict();

const DiffInputSchema = z
  .object({
    path: z
      .string()
      .optional()
      .describe("Optional vault-relative path to limit the diff to a single file"),
    staged: z
      .boolean()
      .default(false)
      .describe("If true, diff the staged index instead of the working tree"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe("Output format: 'markdown' or 'json'"),
  })
  .strict();

const roHints = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export function registerGitTools(server: McpServer, git: GitService): void {
  server.registerTool(
    "mastervault_git_status",
    {
      title: "Git status of the vault",
      description: `Show the git status of the vault (short form, with branch).

Read-only. If the vault is not a git repository, returns an actionable message rather than an error.

Args:
  - response_format ('markdown' | 'json'): default 'markdown'

Returns:
  Branch line plus changed/untracked files in git's short format.

Examples:
  - Use when: checking what has changed in a version-controlled vault.
  - Don't use when: the vault isn't under git (you'll get a clear "not a repo" message).`,
      inputSchema: StatusInputSchema,
      annotations: roHints,
    },
    async (params: { response_format: ResponseFormat }) => {
      try {
        const r = await git.status();
        if (!r.ok) return ok(r.message || "git unavailable", { ok: false, is_repo: r.isRepo });
        const structured = { ok: true, output: r.output };
        if (params.response_format === ResponseFormat.JSON) {
          return ok(JSON.stringify(structured, null, 2), structured);
        }
        return ok(r.output.trim() || "(clean working tree)", structured);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "mastervault_git_log",
    {
      title: "Git log of the vault",
      description: `Show recent commits (one line each, with refs).

Read-only. If the vault is not a git repository, returns an actionable message.

Args:
  - limit (number): recent commits to show (1-100, default 10)
  - response_format ('markdown' | 'json'): default 'markdown'

Returns:
  Recent commit lines (hash, refs, subject).

Examples:
  - Use when: reviewing recent history of a version-controlled vault.`,
      inputSchema: LogInputSchema,
      annotations: roHints,
    },
    async (params: { limit: number; response_format: ResponseFormat }) => {
      try {
        const r = await git.log(params.limit);
        if (!r.ok) return ok(r.message || "git unavailable", { ok: false, is_repo: r.isRepo });
        const structured = { ok: true, output: r.output };
        if (params.response_format === ResponseFormat.JSON) {
          return ok(JSON.stringify(structured, null, 2), structured);
        }
        return ok(r.output.trim() || "(no commits)", structured);
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "mastervault_git_diff",
    {
      title: "Git diff of the vault",
      description: `Show a git diff of the working tree (or the staged index) against HEAD, optionally limited to one file.

Read-only. If the vault is not a git repository, returns an actionable message.

Args:
  - path (string, optional): vault-relative file to limit the diff to
  - staged (boolean): diff the staged index instead of the working tree (default false)
  - response_format ('markdown' | 'json'): default 'markdown'

Returns:
  Unified diff text.

Examples:
  - Use when: reviewing uncommitted changes before a commit.
  - Don't use when: you want file contents (use mastervault_read) rather than a diff.`,
      inputSchema: DiffInputSchema,
      annotations: roHints,
    },
    async (params: { path?: string; staged: boolean; response_format: ResponseFormat }) => {
      try {
        const r = await git.diff(params.path, params.staged);
        if (!r.ok) return ok(r.message || "git unavailable", { ok: false, is_repo: r.isRepo });
        const structured = { ok: true, output: r.output };
        if (params.response_format === ResponseFormat.JSON) {
          return ok(JSON.stringify(structured, null, 2), structured);
        }
        return ok(r.output.trim() || "(no differences)", structured);
      } catch (err) {
        return fail(err);
      }
    }
  );
}
