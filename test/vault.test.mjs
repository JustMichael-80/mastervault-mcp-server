// Unit tests for VaultService — the filesystem spine and its security boundary.
// Run: npm test   (node --test)
// Each test gets an isolated temp vault so tests never interfere with each other.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { VaultService, PathSecurityError } from "../dist/services/vault.js";

let root;
let vault;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "mv-test-"));
  vault = new VaultService(root);
  await fs.mkdir(path.join(root, "_Meta"), { recursive: true });
  await fs.mkdir(path.join(root, "_ToDelete"), { recursive: true });
  await fs.mkdir(path.join(root, "sub"), { recursive: true });
  await fs.writeFile(path.join(root, "a.md"), "---\ntitle: A\n---\nalpha bravo charlie\nsecond line\n");
  await fs.writeFile(path.join(root, "sub", "b.md"), "nested note mentions charlie\n");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test("read returns content and parses markdown frontmatter", async () => {
  const r = await vault.read("a.md");
  assert.match(r.content, /alpha bravo charlie/);
  assert.equal(r.frontmatter.title, "A");
});

test("read honors a line range", async () => {
  const r = await vault.read("a.md", 4, 4);
  assert.equal(r.content.trim(), "alpha bravo charlie");
});

test("list returns directories first, then files, alphabetical", async () => {
  const r = await vault.list("");
  const types = r.entries.map((e) => e.type);
  const firstFile = types.indexOf("file");
  const lastDir = types.lastIndexOf("directory");
  assert.ok(lastDir < firstFile, "all directories should precede files");
});

test("list paginates with offset/limit and reports has_more", async () => {
  const r = await vault.list("", 0, 2);
  assert.equal(r.count, 2);
  assert.equal(r.has_more, true);
  assert.equal(r.next_offset, 2);
});

test("search finds a term across nested files", async () => {
  const r = await vault.search("charlie");
  const paths = r.hits.map((h) => h.path).sort();
  assert.deepEqual(paths, ["a.md", "sub/b.md"]);
});

test("search is case-insensitive", async () => {
  const r = await vault.search("CHARLIE");
  assert.ok(r.total >= 2);
});

test("write then read round-trips, and creates parent dirs", async () => {
  await vault.write("deep/new/file.md", "hello world");
  const r = await vault.read("deep/new/file.md");
  assert.equal(r.content, "hello world");
});

test("append adds a line to an existing file", async () => {
  await vault.write("app.md", "line1");
  await vault.append("app.md", "\nline2");
  const r = await vault.read("app.md");
  assert.match(r.content, /line1\nline2/);
});

test("move relocates a file and removes the source", async () => {
  const r = await vault.move("a.md", "_ToDelete/a.md");
  assert.equal(r.to, "_ToDelete/a.md");
  assert.equal(await vault.exists("a.md"), false);
  assert.equal(await vault.exists("_ToDelete/a.md"), true);
});

test("move refuses to overwrite unless overwrite=true", async () => {
  await vault.write("x.md", "one");
  await vault.write("y.md", "two");
  await assert.rejects(() => vault.move("x.md", "y.md"), /already exists/);
  // with overwrite it succeeds
  await vault.move("x.md", "y.md", true);
  assert.equal((await vault.read("y.md")).content, "one");
});

// ---- Security boundary ----------------------------------------------------

test("SECURITY: rejects ../ traversal on read", async () => {
  await assert.rejects(() => vault.read("../../../etc/passwd"), PathSecurityError);
});

test("SECURITY: treats a leading slash as vault-relative, not absolute", async () => {
  // '/etc/passwd' must resolve inside the vault (and thus not exist), never /etc/passwd
  assert.equal(await vault.exists("/etc/passwd"), false);
  await assert.rejects(() => vault.read("/etc/passwd"), /not found|ENOENT|resolves outside/i);
});

test("SECURITY: rejects an escaping move destination", async () => {
  await assert.rejects(() => vault.move("a.md", "../escaped.md"), PathSecurityError);
});

test("SECURITY: rejects a null byte in a path", async () => {
  await assert.rejects(() => vault.read("a\0.md"), PathSecurityError);
});

test("SECURITY: a symlink pointing outside the vault is rejected on read", async () => {
  // create a symlink inside the vault that targets /etc
  const linkPath = path.join(root, "evil");
  try {
    await fs.symlink("/etc", linkPath);
  } catch {
    return; // symlink not permitted in this env; skip rather than false-fail
  }
  await assert.rejects(() => vault.read("evil/passwd"), PathSecurityError);
});
