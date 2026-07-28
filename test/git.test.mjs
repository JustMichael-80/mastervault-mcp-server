// Git-tier tests: real temp repo, non-repo guard, and shell-injection safety.
// Runs under `npm test` alongside the vault and tools suites.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as os from "node:os";
import * as path from "node:path";
import { GitService } from "../dist/services/git.js";

const exec = promisify(execFile);
let repo, plain;

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), "git-vault-"));
  await exec("git", ["-C", repo, "init", "-q"]);
  await exec("git", ["-C", repo, "config", "user.email", "t@t.com"]);
  await exec("git", ["-C", repo, "config", "user.name", "t"]);
  await fs.writeFile(path.join(repo, "_orientation.md"), "# orient\n");
  await exec("git", ["-C", repo, "add", "-A"]);
  await exec("git", ["-C", repo, "commit", "-q", "-m", "initial"]);
  plain = await fs.mkdtemp(path.join(os.tmpdir(), "plain-vault-"));
});

afterEach(async () => {
  await fs.rm(repo, { recursive: true, force: true });
  await fs.rm(plain, { recursive: true, force: true });
});

test("git status works on a real repo and shows changes", async () => {
  await fs.writeFile(path.join(repo, "note.md"), "changed\n");
  const r = await new GitService(repo).status();
  assert.equal(r.ok, true);
  assert.match(r.output, /note\.md/);
});

test("git log shows commits", async () => {
  const r = await new GitService(repo).log(5);
  assert.equal(r.ok, true);
  assert.match(r.output, /initial/);
});

test("git diff shows a working-tree change", async () => {
  await fs.writeFile(path.join(repo, "_orientation.md"), "# orient CHANGED\n");
  const r = await new GitService(repo).diff();
  assert.equal(r.ok, true);
  assert.match(r.output, /CHANGED/);
});

test("git tools return an actionable message on a non-repo, not a throw", async () => {
  const r = await new GitService(plain).status();
  assert.equal(r.ok, false);
  assert.equal(r.isRepo, false);
  assert.match(r.message, /not a git repository/i);
});

test("SECURITY: a shell-metachar path is inert (no injection)", async () => {
  const marker = `/tmp/PWNED_${Date.now()}.txt`;
  const evil = `; touch ${marker}`;
  await new GitService(repo).diff(evil); // passed as pathspec after --, never shell-eval'd
  let created = false;
  try {
    await fs.access(marker);
    created = true;
  } catch {
    created = false;
  }
  assert.equal(created, false, "shell metacharacters in a path must not execute");
});

test("git log clamps limit into 1..100", async () => {
  const r = await new GitService(repo).log(99999);
  assert.equal(r.ok, true); // clamped, does not error
});
