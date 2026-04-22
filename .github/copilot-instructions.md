# Copilot / Coding Agent Instructions — chamber-19/shopvac

These instructions apply to **every** Copilot Chat session and every Copilot
coding-agent task in this repository. Treat them as binding requirements.

## 1. Documentation currency is non-negotiable

Shopvac is a new project, but documentation discipline applies from day one —
not after the first production incident. Stale docs create technical debt that
compounds; treat the table below as a binding contract enforced at PR review.

Every PR you produce **must** keep the following docs in lockstep with the code:

| When you change … | You must also update … |
|---|---|
| `frontend/src-tauri/tauri.conf.json` (`version`), `frontend/package.json` (`version`), or `frontend/src-tauri/Cargo.toml` (`version`) | All three together — they MUST match. Plus `RELEASING.md` examples if a release notes pattern changed. |
| The `@chamber-19/desktop-toolkit` pin in `frontend/package.json` | Also bump the matching `tag = "vX.Y.Z"` in `frontend/src-tauri/Cargo.toml`. Run `npm install` (in `frontend/`) and `cargo update -p desktop-toolkit --manifest-path frontend/src-tauri/Cargo.toml` to refresh both lockfiles in the same commit. |
| `.github/workflows/release.yml` | `RELEASING.md` if any user-visible step changed; `TROUBLESHOOTING.md` if a failure mode changed. |
| `scripts/publish-to-drive.ps1` | `RELEASING.md` § "Publish to shared drive" and `TROUBLESHOOTING.md` § "Stale cached installer" |
| `frontend/src-tauri/src/updater.rs` (if added) | `docs/AUTO_UPDATER.md` and `TROUBLESHOOTING.md` § "Update log" |
| `tools/ch19-line-totaler/Commands.cs` or `tools/ch19-line-totaler/Ch19LineTotaler.csproj` | `tools/ch19-line-totaler/README.md` in the same PR — keep command names, version, and build steps in sync. |
| Anything user-facing in behaviour | `CHANGELOG.md` (once it is added at v1.0) or the next `RELEASE_NOTES.md` |

<!-- NOTE: a `backend/requirements*.txt` row should be added here if a Python
     sidecar is introduced in a future release. See transmittal-builder's
     copilot-instructions.md for the pattern to follow. -->

If a PR changes code but leaves a doc inconsistent, the PR is incomplete.
Either fix the doc in the same PR, or open a tracking issue **before**
merging and link it from the PR description.

## 2. Never leave historical references unmarked

Any file that preserves the state of the world at a specific point in time
must start with a `> **Historical archive:** …` blockquote callout:

```markdown
> **Historical archive:** this document predates X. Use <a>Y</a> for
> current guidance.
```

If a doc is _not_ historical and contains a reference to an older state,
update it instead of marking it archival.

## 3. Markdown formatting

All `*.md` files must pass `markdownlint-cli2 "**/*.md"` against the rules
in `.markdownlint.jsonc`. In short:

- Fenced code blocks: declare a language (`text` for ASCII, never bare).
- Use `_emphasis_` and `**strong**` consistently.
- Surround headings, lists, and fenced blocks with blank lines.
- First line of every file is a `#` H1; archival callouts go below it.

## 4. Release-bump checklist

When cutting a new Shopvac release, follow `RELEASING.md` § 2 exactly:

0. **If releasing the AutoCAD plugin (`tools/ch19-line-totaler/`):**
   bump `tools/ch19-line-totaler/Properties/AssemblyInfo.cs` and
   `tools/ch19-line-totaler/Ch19LineTotaler.csproj` in that PR.
   The AutoCAD plugin versions **independently** from the desktop app — do
   not tie its version to the desktop tag.

1. Bump version in **all three**: `frontend/package.json`,
   `frontend/src-tauri/tauri.conf.json`, `frontend/src-tauri/Cargo.toml`.
2. Refresh both lockfiles (`npm install` + `cargo update -p desktop-toolkit`) in
   the same commit.
3. Smoke-test locally: delete `frontend/src-tauri/target/release/bundle/` then
   run `npm run desktop:build` and verify the only `.exe` produced has the new
   version in its filename.
4. Tag, push, monitor CI.
5. Verify the GitHub Release asset filename matches the tag.
6. Run `scripts/publish-to-drive.ps1 -Tag vX.Y.Z`.
7. Update any version examples in `TROUBLESHOOTING.md` and `MIGRATION.md`
   that were tied to the previous version.

## 5. MCP / agent context

This repo provides MCP servers for both VS Code Copilot Chat and the cloud
Copilot coding agent. See [`docs/mcp.md`](../docs/mcp.md) for the catalogue
of servers and how to configure them. The cloud agent's MCP config lives at
[`.github/copilot/mcp-config.json`](./copilot/mcp-config.json); the local
VS Code config is [`.vscode/mcp.json`](../.vscode/mcp.json). Keep the two
in functional parity — if you add or remove a server in one, update the
other (and `docs/mcp.md`) in the same PR.

## 6. Reference docs

- [`RELEASING.md`](../RELEASING.md) — release lifecycle (must always reflect the latest released version)
- [`TROUBLESHOOTING.md`](../TROUBLESHOOTING.md) — diagnostic playbook
- [`MIGRATION.md`](../MIGRATION.md) — version-to-version upgrade notes
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — local dev workflow
- [`docs/mcp.md`](../docs/mcp.md) — MCP server catalogue
- [`docs/AUTO_UPDATER.md`](../docs/AUTO_UPDATER.md) — auto-updater contract

If you find a discrepancy between code and these docs, fixing the doc is
part of your job, not someone else's.
