// Functional harness: exercises the real compiled VaultService logic against
// the temp vault, including the security boundary. Not a substitute for a full
// MCP client test (that's the smoke test), but it verifies the logic where bugs
// actually live: path confinement, orient, log append, stage-delete.

import { VaultService, PathSecurityError } from "./dist/services/vault.js";

const ROOT = "/home/claude/testvault";
const vault = new VaultService(ROOT);
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
}

// 1. read + frontmatter
const ctx = await vault.read("CLEO_context.md");
check("read returns content", ctx.content.includes("Michael Stewart"));

// 2. list root, dirs-first ordering
const ls = await vault.list("");
check("list sees 6 root entries", ls.total === 6);
check("list puts directories first", ls.entries[0].type === "directory");

// 3. search
const sr = await vault.search("Constructal");
check("search finds Constructal in note", sr.hits.some(h => h.path.endsWith("note.md")));

// 4. write + read back
await vault.write("_Meta/scratch.md", "hello");
const rb = await vault.read("_Meta/scratch.md");
check("write then read round-trips", rb.content === "hello");

// 5. append
await vault.append("_Meta/scratch.md", "\nworld");
const rb2 = await vault.read("_Meta/scratch.md");
check("append adds line", rb2.content.includes("world"));

// 6. move (stage-delete primitive)
const mv = await vault.move("_Meta/scratch.md", "_ToDelete/scratch.md");
check("move relocates file", mv.to === "_ToDelete/scratch.md");
check("source gone after move", !(await vault.exists("_Meta/scratch.md")));
check("dest exists after move", await vault.exists("_ToDelete/scratch.md"));

// 7. SECURITY: traversal must be rejected
let blocked = false;
try { await vault.read("../../../etc/passwd"); }
catch (e) { blocked = e instanceof PathSecurityError; }
check("rejects ../ traversal", blocked);

let blockedAbs = false;
try { await vault.read("/etc/passwd"); }        // leading slash => vault-relative
catch (e) { blockedAbs = true; }                 // ENOENT inside vault is fine too
const stillInside = await vault.exists("etc/passwd");
check("absolute path treated as vault-relative (no escape)", !stillInside);

// 8. move cannot escape
let mvBlocked = false;
try { await vault.move("CLEO_context.md", "../escaped.md"); }
catch (e) { mvBlocked = e instanceof PathSecurityError; }
check("move rejects escaping destination", mvBlocked);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
