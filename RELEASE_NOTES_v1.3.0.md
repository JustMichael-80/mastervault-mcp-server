# mastervault-mcp-server v1.3.0

A headless, filesystem-backed MCP server that serves any MasterVault — its files
and its operating protocol — to any MCP client over stdio. No Obsidian required.

## What's new in 1.3.0

- **Git read-only tools** — `mastervault_git_status`, `mastervault_git_log`,
  `mastervault_git_diff`. A fourth tool tier for version-controlled vaults, all
  read-only. Uses argument arrays (no shell-injection surface) and returns a
  clear message when the vault isn't a git repo instead of erroring.
- **Evaluation suite** — 10 QA pairs (`evaluations/eval.xml`) against a
  deterministic fixture vault, in the mcp-builder format; answers validated
  against the real tools.
- Test suite grown to **31 tests** (adds git-tier + shell-injection-safety +
  non-repo guard).
- **npm-publish ready** — `npm publish` ships dist + README + LICENSE +
  CHANGELOG only (no source, tests, evals, or fixtures).

## Tool surface

12 tools in four tiers — protocol (orient, confidence-summary, log-decision),
files (read, list, search, write, patch), soft-delete (stage-delete), and git
(status, log, diff) — plus `mastervault_list_vaults` when started in
`--discover` mode.

## Since 1.1.x

- Multi-vault discovery (`--discover <root>`) — *idea by Grigori Korotkikh*.
- Bundled single-file build (`npm run build:bundled`) — *from the ModelForge
  integration, voidstackloop*.
- macOS symlink path-security fix.

Full changelog in CHANGELOG.md.
