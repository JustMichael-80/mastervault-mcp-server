# mastervault-mcp-server v1.2.0

A headless, filesystem-backed MCP server that serves any MasterVault — its files
and its operating protocol — to any MCP client over stdio. No Obsidian required.

## What's new in 1.2.0

- **Multi-vault discovery (`--discover <root>`)** — point the server at a parent
  directory and it finds every MasterVault beneath it (any dir with an
  `_orientation.md`), listing them via the new `mastervault_list_vaults` tool.
  Depth-bounded scan, skips hidden/dependency dirs, doesn't follow symlinks out
  of the tree. File operations stay confined to the active vault's sanitized
  root — discovery only *locates* vaults, it can't be used to escape into an
  arbitrary path.
  *Idea contributed by **Grigori Korotkikh**.*

## Since 1.1.x

- **Bundled single-file build** (`npm run build:bundled`) — self-contained
  `dist-bundled/index.js` for vendoring with no install step. *(from the
  ModelForge integration, voidstackloop)*
- **macOS symlink path-security fix** — vault root canonicalized via `realpath`
  so legitimate in-vault paths aren't falsely rejected where the OS puts
  directories behind symlinks. Security boundary intact.
- **25-test suite** and **npm publish configuration**.

## The tools

Protocol: `mastervault_orient`, `mastervault_get_confidence_summary`,
`mastervault_log_decision` · Files: `read`, `list`, `search`, `write`, `patch` ·
Soft-delete: `mastervault_stage_delete` · Discovery (in `--discover` mode):
`mastervault_list_vaults`.

Full changelog in CHANGELOG.md.
