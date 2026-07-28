/**
 * GitService — read-only git helpers for the active vault.
 *
 * Security: every git invocation uses execFile with an ARGUMENT ARRAY, never a
 * shell string. There is no command interpolation and no shell involved, so a
 * malicious filename or argument cannot inject a command. All operations run
 * with `-C <vaultRoot>` and are read-only (status/log/diff) — no writes, no
 * commit, no checkout.
 *
 * If the vault is not a git repository, methods return an actionable message
 * object rather than throwing, so the tool layer can report it cleanly.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitResult {
  ok: boolean;
  isRepo: boolean;
  output: string;
  message?: string;
}

export class GitService {
  private readonly root: string;

  constructor(vaultRoot: string) {
    this.root = vaultRoot;
  }

  /** Run a read-only git subcommand with a fixed argument array. */
  private async run(args: string[]): Promise<GitResult> {
    try {
      const { stdout } = await execFileAsync("git", ["-C", this.root, ...args], {
        maxBuffer: 4 * 1024 * 1024, // 4MB cap on git output
        timeout: 15000,
      });
      return { ok: true, isRepo: true, output: stdout };
    } catch (err) {
      const e = err as { stderr?: string; message?: string; code?: number };
      const stderr = (e.stderr || e.message || "").toString();
      // Distinguish "not a repo" from real errors, so the tool can guide the user.
      if (/not a git repository/i.test(stderr)) {
        return {
          ok: false,
          isRepo: false,
          output: "",
          message:
            "This vault is not a git repository. Git tools only work when the vault is under version control (a `.git` directory at the vault root).",
        };
      }
      return {
        ok: false,
        isRepo: true,
        output: "",
        message: `git error: ${stderr.trim() || "unknown error"}`,
      };
    }
  }

  /** `git status` in short form with branch line. */
  async status(): Promise<GitResult> {
    return this.run(["status", "--short", "--branch"]);
  }

  /** `git log` — most recent N commits, one line each. N is clamped 1..100. */
  async log(limit: number): Promise<GitResult> {
    const n = Math.max(1, Math.min(100, Math.floor(limit)));
    return this.run(["log", `-${n}`, "--oneline", "--decorate"]);
  }

  /**
   * `git diff`. With no path, diffs the working tree against HEAD. With a path,
   * limits to that pathspec. `staged` diffs the index instead of the worktree.
   * The path is passed as a separate argv element after `--`, so it cannot be
   * interpreted as a flag or a command.
   */
  async diff(path?: string, staged = false): Promise<GitResult> {
    const args = ["diff"];
    if (staged) args.push("--staged");
    if (path) args.push("--", path);
    return this.run(args);
  }
}
