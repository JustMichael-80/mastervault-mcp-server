# HANDOFF — status

All originally-deferred work is now complete as of v1.3.0 (2026-07-28).

- [DONE] Task 1 — Evaluation suite. `evaluations/eval.xml` (10 QA pairs) +
  `evaluations/fixture-vault/`. Answers validated against the real tools.
- [DONE] Task 2 — Unit tests. `npm test`, now 31 tests: vault layer, security
  boundary, tool layer, git tier, shell-injection safety.
- [DONE] Task 3 — Git read tools. `mastervault_git_status/log/diff`, read-only,
  argument-array (no injection), non-repo guarded.
- [DONE] Task 4 — Packaging. npm-publish verified (ships dist+README+LICENSE+
  CHANGELOG only); LICENSE + .gitignore present; bundled build available.

## Remaining (optional, requires the owner's credentials — not code work)

- [ ] `npm publish` — the package is publish-ready and verified via
  `npm pack --dry-run`. Publishing requires an npm account + auth token, so it
  is the owner's step, not automatable here. Once published,
  `npx -y mastervault-mcp-server <vault>` works for any consumer.
- [ ] Optional: a `.github/workflows/ci.yml` running build + test on push
  (mirrors what the ModelForge downstream already does for its vendored copy).

## Not in scope (by design)

- No hard-delete tool, ever.
- No `git_commit` / write-git tools — git tier stays read-only.
- No shell/run_command tool — clients provide their own.
