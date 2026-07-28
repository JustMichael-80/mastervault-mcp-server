# Changelog

## 1.3.0 — 2026-07-28
### Added
- **Git read-only tools** (`mastervault_git_status`, `mastervault_git_log`,
  `mastervault_git_diff`) — a fourth tool tier for version-controlled vaults.
  All read-only. Backed by a GitService that shells out via argument arrays
  (never string interpolation — no shell-injection surface) and returns an
  actionable message when the vault isn't a git repo rather than throwing.
- **Evaluation suite** (`evaluations/eval.xml` + `evaluations/fixture-vault/`) —
  10 QA pairs in the mcp-builder format, each verifiable against a deterministic
  fixture vault. Answers validated against the real tools.
- Git-tier tests folded into `npm test` (now 31 tests), including a
  shell-injection-safety test and the non-repo guard.

### Notes
- Server now exposes 12 tools (13 in `--discover` mode). npm-publish ready:
  `npm publish` ships dist + README + LICENSE + CHANGELOG only.

## 1.2.0 — 2026-07-27
### Added
- **Multi-vault discovery mode (`--discover <root>`).** Point the server at a
  parent directory and it discovers every MasterVault beneath it (any directory
  containing an `_orientation.md`), exposing them via the new
  `mastervault_list_vaults` tool. Bounded scan depth; skips hidden/dependency
  dirs; does not follow symlinks out of the tree. The first discovered vault is
  served as the active vault.
  *Idea contributed by **Grigori Korotkikh**. Adapted to the existing security
  model: discovery only locates vaults; all file operations remain confined to a
  path-sanitized VaultService, so a vault name can never select an arbitrary
  path.*

## 1.1.2 — 2026-07-27
### Changed
- Version alignment with the ModelForge downstream integration (no functional
  change from 1.1.0).

## 1.1.0 — 2026-07-26
### Added
- **Bundled build (`npm run build:bundled`).** Produces a single self-contained
  `dist-bundled/index.js` (~870kb) with all dependencies inlined via esbuild, so
  the server can be shipped/vendored as one file with no `npm install` at the
  consumer end. Includes a `createRequire` banner shim for CommonJS interop under
  ESM. *Contributed by the ModelForge integration (voidstackloop) and folded back
  upstream.*
- Repository/homepage/author metadata for npm publish readiness.

### Fixed
- Version string in `index.ts` now matches `package.json` (was stale at 1.0.0).

### Note
- Verified: bundled server completes an MCP stdio handshake and exposes all 9
  tools, in addition to the standard `tsc` build. Full 25-test suite green.

## 1.0.1 — 2026-07-26
### Fixed
- **Path security check no longer rejects legitimate in-vault paths on macOS.**
  `assertRealPathInside` compared a symlink-resolved (realpath) file path against
  a non-resolved vault root. On systems where the OS places real directories
  behind symlinks (notably macOS: `/var` → `/private/var`, and many temp/home
  paths), this caused every real filesystem operation to be wrongly rejected as
  "outside the vault root." The vault root is now canonicalized via `realpath`
  (lazily, once, cached) so both sides of the containment check are compared in
  canonical form. Security is unaffected: lexical `..` traversal, absolute paths,
  null bytes, and in-vault symlinks that escape the vault are all still rejected
  (verified by simulating a symlinked vault root).

### Added
- Test suite (`npm test`, 25 tests) covering VaultService, the security
  boundary, and the tool layer.
- npm publish configuration (`files`, `publishConfig`, `prepublishOnly`).

## 1.0.0 — 2026-07-25
- Initial build: 9 tools across protocol / files / delete tiers, stdio MCP
  server, path-confinement security boundary.
