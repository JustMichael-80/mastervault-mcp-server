# mastervault-mcp-server v1.1.0

A headless, filesystem-backed MCP server that serves any MasterVault — its files
and its operating protocol — to any MCP client over stdio. No Obsidian required.

## What's new in 1.1.0

- **Bundled single-file build** (`npm run build:bundled`) — produces a
  self-contained `dist-bundled/index.js` with all dependencies inlined, so the
  server can be vendored or shipped as one file with no install step. Built with
  esbuild; includes a `createRequire` shim for CJS/ESM interop. Verified to
  complete an MCP stdio handshake and expose all 9 tools.
  *This capability came from the ModelForge integration (voidstackloop) and was
  folded back upstream.*

## Included since 1.0.1

- **macOS symlink path-security fix** — the vault root is canonicalized via
  `realpath` so legitimate in-vault paths are no longer falsely rejected on
  platforms where the OS places directories behind symlinks (macOS `/var` →
  `/private/var`). Security boundary intact: traversal, absolute paths, null
  bytes, and escaping in-vault symlinks all still rejected.
- **25-test suite** (`npm test`) — filesystem layer, security boundary, tool layer.
- **npm publish configuration** — ready for `npm publish` / `npx` distribution.

## The 9 tools

Protocol: `mastervault_orient`, `mastervault_get_confidence_summary`,
`mastervault_log_decision` · Files: `read`, `list`, `search`, `write`, `patch` ·
Soft-delete: `mastervault_stage_delete` (moves to `_ToDelete/`, never hard-deletes).

## Install

```bash
npm install && npm run build
mastervault-mcp-server /path/to/vault
```

Or bundled: `npm run build:bundled && node dist-bundled/index.js /path/to/vault`

Full changelog in CHANGELOG.md.
