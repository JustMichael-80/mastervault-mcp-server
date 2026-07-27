# Changelog

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
