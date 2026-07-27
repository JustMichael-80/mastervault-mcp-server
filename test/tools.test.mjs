// Tool-layer tests: register the real tools onto an McpServer and invoke their
// handlers in-process, so we exercise the actual registered logic (patch match
// rejection, log_decision section-aware append, stage_delete collision suffix,
// orient multi-file read) rather than reaching into private helpers.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VaultService } from "../dist/services/vault.js";
import { registerProtocolTools } from "../dist/tools/protocol.js";
import { registerFileTools } from "../dist/tools/files.js";
import { registerDeleteTools } from "../dist/tools/delete.js";

let root, vault, handlers;

// Capture the registered handlers by stubbing registerTool.
function collectHandlers(vault) {
  const map = new Map();
  const fakeServer = {
    registerTool(name, _def, handler) {
      map.set(name, handler);
    },
  };
  registerProtocolTools(fakeServer, vault);
  registerFileTools(fakeServer, vault);
  registerDeleteTools(fakeServer, vault);
  return map;
}

async function call(name, args = {}) {
  const h = handlers.get(name);
  assert.ok(h, `handler ${name} should be registered`);
  return h(args);
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "mv-tool-"));
  vault = new VaultService(root);
  handlers = collectHandlers(vault);
  await fs.mkdir(path.join(root, "_Meta"), { recursive: true });
  await fs.mkdir(path.join(root, "_ToDelete"), { recursive: true });
  await fs.writeFile(path.join(root, "_orientation.md"), "# Orientation\nread the filter\n");
  await fs.writeFile(path.join(root, "CLEO_global_filter.md"), "# Filter\nrules\n");
  await fs.writeFile(path.join(root, "CLEO_context.md"), "# Context\nMichael\n");
  await fs.writeFile(path.join(root, "doc.md"), "unique line here\nrepeated\nrepeated\n");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test("all 9 tools register", () => {
  const expected = [
    "mastervault_orient",
    "mastervault_get_confidence_summary",
    "mastervault_log_decision",
    "mastervault_read",
    "mastervault_list",
    "mastervault_search",
    "mastervault_write",
    "mastervault_patch",
    "mastervault_stage_delete",
  ];
  for (const name of expected) assert.ok(handlers.has(name), `${name} missing`);
  assert.equal(handlers.size, 9);
});

test("orient reads all present protocol files and reports none missing", async () => {
  const res = await call("mastervault_orient", { response_format: "json" });
  const sc = res.structuredContent;
  assert.deepEqual(sc.protocol_files_missing, []);
  assert.equal(sc.protocol_files_present.length, 3);
});

test("orient reports a missing protocol file rather than failing", async () => {
  await fs.rm(path.join(root, "CLEO_context.md"));
  const res = await call("mastervault_orient", { response_format: "json" });
  assert.ok(res.structuredContent.protocol_files_missing.includes("CLEO_context.md"));
  assert.ok(!res.isError);
});

test("patch rejects when old_str is not found", async () => {
  const res = await call("mastervault_patch", {
    path: "doc.md",
    old_str: "does not exist",
    new_str: "x",
    response_format: "markdown",
  });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /not found/i);
});

test("patch rejects when old_str matches more than once", async () => {
  const res = await call("mastervault_patch", {
    path: "doc.md",
    old_str: "repeated",
    new_str: "x",
    response_format: "markdown",
  });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /unique|matched 2/i);
});

test("patch succeeds on a unique match", async () => {
  const res = await call("mastervault_patch", {
    path: "doc.md",
    old_str: "unique line here",
    new_str: "changed",
    response_format: "json",
  });
  assert.equal(res.structuredContent.replacements, 1);
  assert.match((await vault.read("doc.md")).content, /changed/);
});

test("log_decision creates a missing category section and appends a row", async () => {
  await fs.writeFile(
    path.join(root, "_Meta", "Decision Log.md"),
    "# Decision Log — Confidence Calibration Dataset\n\n### vault-structure\n\n| a | b |\n|---|---|\n| 1 | 2 |\n"
  );
  const res = await call("mastervault_log_decision", {
    category: "infrastructure",
    proposal: "test proposal",
    est_confidence: 88,
    verdict: "agree",
    calibration_note: "note",
    response_format: "json",
  });
  assert.equal(res.structuredContent.logged, true);
  const log = (await vault.read("_Meta/Decision Log.md")).content;
  assert.match(log, /### infrastructure/);
  assert.match(log, /test proposal/);
});

test("stage_delete moves the file to _ToDelete and logs a row", async () => {
  await fs.writeFile(path.join(root, "junk.md"), "delete me");
  const res = await call("mastervault_stage_delete", {
    path: "junk.md",
    reason: "stale",
    est_confidence: 70,
    response_format: "json",
  });
  assert.equal(res.structuredContent.staged, true);
  assert.equal(await vault.exists("junk.md"), false);
  assert.equal(await vault.exists("_ToDelete/junk.md"), true);
});

test("stage_delete suffixes on name collision instead of clobbering", async () => {
  await fs.writeFile(path.join(root, "_ToDelete", "dupe.md"), "already here");
  await fs.writeFile(path.join(root, "dupe.md"), "the new one");
  const res = await call("mastervault_stage_delete", {
    path: "dupe.md",
    reason: "collision test",
    est_confidence: 50,
    response_format: "json",
  });
  // original in _ToDelete is preserved
  assert.equal((await vault.read("_ToDelete/dupe.md")).content, "already here");
  // new one landed under a suffixed name
  assert.match(res.structuredContent.to, /_ToDelete\/dupe\..*\.md|_ToDelete\/dupe\.md/);
  assert.notEqual(res.structuredContent.to, "_ToDelete/dupe.md");
});

test("stage_delete on a missing file errors cleanly", async () => {
  const res = await call("mastervault_stage_delete", {
    path: "ghost.md",
    reason: "nope",
    est_confidence: 50,
    response_format: "markdown",
  });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /not found/i);
});
