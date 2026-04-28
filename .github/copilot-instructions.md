# Copilot Instructions

> **Family-wide rules:** See [chamber-19/.github](https://github.com/chamber-19/.github/blob/main/.github/copilot-instructions.md) for Chamber 19 org-wide Copilot guidance. This file contains **repo-specific** rules only.
>
> **Repo:** `chamber-19/launcher`
> **Role:** Tauri shell that installs, updates, and launches Chamber 19 engineering tools

---

## v0.3.x scope boundary — DO NOT cross

**Do NOT add in v0.1.x–v0.3.x:**

- A plugin catalog format (remote-fetched, user-editable, or otherwise). The launcher knows about plugins by hardcoded list. A catalog is a v0.4+ concern and only makes sense once there are 3+ plugins to catalog.
- Out-of-process communication with AutoCAD (named-pipe bridges, ROT enumeration, command dispatch). The launcher manages DLL files on disk and LISP entries — it does not talk to AutoCAD at runtime.
- Silent background updates. v0.3.0 checks at launch only — no timers, no periodic polls.
- Rollback of failed installs. An install that fails leaves the previous version in place; the user retries.
- A plugin source directory in this repo (`tools/`, `plugins/`, etc.). Plugins live in their own repos.

**Launcher-specific architectural decisions:**

- This repo was renamed from `shopvac` to `launcher`. Old clones need `git remote set-url origin https://github.com/chamber-19/launcher.git`.
- `frontend/` was renamed to `shell/`. Any reference to `frontend/` in docs or code paths is stale.
- GitHub Packages versions are immutable. Fix forward with a new patch version upstream; never try to yank a published `@chamber-19/desktop-toolkit` release.

---

## 1. Documentation currency is non-negotiable

Documentation discipline applies from day one — not after the first production incident. Stale docs create technical debt that compounds; treat the table below as a binding contract enforced at PR review.

Every PR you produce **must** keep the following docs in lockstep with the code:

| When you change … | You must also update … |
|---|---|
| `shell/src-tauri/tauri.conf.json` (`version`), `shell/package.json` (`version`), or `shell/src-tauri/Cargo.toml` (`version`) | All three together — they MUST match. Plus `RELEASING.md` examples if a release notes pattern changed. |
| The `@chamber-19/desktop-toolkit` pin in `shell/package.json` | Also bump the matching `tag = "vX.Y.Z"` in `shell/src-tauri/Cargo.toml`. Run `npm install` (in `shell/`) and `cargo update -p desktop-toolkit --manifest-path shell/src-tauri/Cargo.toml` to refresh both lockfiles in the same commit. |
| `.github/workflows/release.yml` | `RELEASING.md` if any user-visible step changed; `TROUBLESHOOTING.md` if a failure mode changed. |
| `scripts/publish-to-drive.ps1` (if present) | `RELEASING.md` § "Publish to shared drive" and `TROUBLESHOOTING.md` § "Stale cached installer" |
| `shell/src-tauri/src/updater.rs` | `docs/AUTO_UPDATER.md` (if present) and `TROUBLESHOOTING.md` § "Update log" |
| Plugin installer logic (anywhere in `shell/src-tauri/src/plugin_installer*.rs` or `shell/src/installer/*`) | `docs/PLUGIN_INSTALLER.md` (create if absent) and `README.md` if user-facing behavior changed |
| The plugin catalog (hardcoded list in `shell/src/plugins/pluginCatalog.js` or equivalent) | `README.md` "Current tools managed" section and `CHANGELOG.md` |
| Anything user-facing in behaviour | `CHANGELOG.md` under `## [Unreleased]` |

If a PR changes code but leaves a doc inconsistent, the PR is incomplete. Either fix the doc in the same PR, or open a tracking issue **before** merging and link it from the PR description.

## 2. Never leave historical references unmarked

Any file that preserves the state of the world at a specific point in time must start with a `> **Historical archive:** …` blockquote callout:

```markdown
> **Historical archive:** this document predates X. Use [Y](./Y.md) for
> current guidance.
```

If a doc is _not_ historical and contains a reference to an older state, update it instead of marking it archival.

Canonical examples in this repo are any docs that still reference `shopvac` or `frontend/` — those are historical and should either be updated or archived explicitly.

## 3. Markdown formatting

All `*.md` files must pass `markdownlint-cli2 "**/*.md"` against the rules in `.markdownlint.jsonc`. In short:

- Fenced code blocks: always declare a language. Use `text` for prose, ASCII art, or shell session output — never a bare block
- Use `_emphasis_` and `**strong**` consistently
- Surround headings, lists, and fenced blocks with blank lines
- First line of every file is a `#` H1; archival callouts go below it

## 4. Release-bump checklist

When cutting a new Launcher release, follow `RELEASING.md` exactly:

1. Bump version in **all three**: `shell/package.json`, `shell/src-tauri/tauri.conf.json`, `shell/src-tauri/Cargo.toml`
2. Refresh both lockfiles (`npm install` + `cargo update -p desktop-toolkit`) in the same commit
3. Smoke-test locally: delete `shell/src-tauri/target/release/bundle/` then run `npm run tauri build` from `shell/` and verify the only `.exe` produced has the new version in its filename
4. Tag, push, monitor CI
5. Verify the GitHub Release asset filename matches the tag and `latest.json` is attached
6. Run `scripts/publish-to-drive.ps1 -Tag vX.Y.Z` (if shared-drive distribution is used)
7. Update any version examples in `TROUBLESHOOTING.md` and `MIGRATION.md` that were tied to the previous version
8. Use the `time` MCP server for the release date in `CHANGELOG.md` — do not guess it

Note: the AutoCAD plugin (`chamber-19/object-totaler`) versions **independently** from the launcher. A launcher release does not imply a plugin release or vice versa.

## 5. Plugin installer conventions

These are the invariants of the installer flow. Deviating from them breaks user installs silently.

### Install location

All plugin DLLs install under `%APPDATA%\Chamber19\AutoCAD\`. Never under Program Files, never under AutoCAD's own install directory, never under the user's Documents folder.

Reasons: no admin elevation needed, survives AutoCAD reinstalls, user-scoped so multiple engineers on the same machine don't collide.

### NETLOAD registration

The launcher appends/updates a NETLOAD line in the user's `acaddoc.lsp`, typically at `%APPDATA%\Autodesk\AutoCAD <version>\R<rel>\enu\Support\acaddoc.lsp`. If the file doesn't exist, create it. If the file exists, read it, modify the relevant line(s) in memory, write to `acaddoc.lsp.new`, then rename over — never edit in place.

For v0.3.x, pick the highest-versioned AutoCAD install on the machine if multiple exist. Multi-version support is v0.4+.

### Installed manifest

Persistent state lives in `%APPDATA%\Chamber19\installed.json`. Schema:

```json
{
  "schema_version": 1,
  "plugins": {
    "<plugin-id>": {
      "installed_version": "x.y.z",
      "installed_at": "ISO-8601",
      "dll_path": "absolute path",
      "sha256": "lowercase hex",
      "netload_registered": true
    }
  }
}
```

Write atomically (`.new` → rename). If `schema_version` ever changes, document the migration in `MIGRATION.md`.

### SHA256 verification

Before writing any downloaded DLL to the final install path, verify its SHA256 against the `.sha256` file from the same release. Mismatch = abort install, show error, do NOT partial-install.

Do not skip this check "because it's a public GitHub repo" — it defends against download-path MITM, not just malicious repo content.

### AutoCAD-running detection

Before replacing an existing DLL, check whether AutoCAD (`acad.exe`) is currently running. If yes, do NOT attempt the replacement — Windows file locking will fail the write. Show a "close AutoCAD and relaunch Launcher to install" banner and mark the update as pending in `installed.json`.

Schedule-for-next-boot (`MoveFileEx` with `MOVEFILE_DELAY_UNTIL_REBOOT`) is v0.4+ if the pending-banner UX becomes annoying.

### GitHub Releases as source of truth

The launcher hits `https://api.github.com/repos/<org>/<plugin-repo>/releases/latest` to find new versions. No custom update server, no network share, no CDN. If the plugin repo changes the release asset shape, the launcher breaks — coordinate across repos.

### Fail-open for network issues

If the GitHub API is unreachable (offline, rate limited, outage), show a subtle indicator but let the user continue with whatever's currently installed. Never block the launcher UI behind a network request.

## 6. Plugin catalog — hardcoded for now

For v0.1.x–v0.3.x, the list of known plugins is hardcoded in `shell/src/plugins/pluginCatalog.js` (or equivalent path). Example:

```js
export const PLUGIN_CATALOG = [
  {
    id: "object-totaler",
    displayName: "Object Totaler",
    description: "Totals curve lengths in AutoCAD",
    githubRepo: "chamber-19/object-totaler",
    dllAssetName: "ObjectTotaler.dll",
    shaAssetName: "ObjectTotaler.dll.sha256",
  },
];
```

Adding a plugin to the catalog is a code change that requires a launcher version bump. A remote/user-editable catalog is a v0.4+ concern and not something to add speculatively.

## 7. Directory conventions

- `shell/` is the Tauri + React app. NOT `frontend/`. Any PR that adds or references `frontend/` is wrong.
- No `tools/`, `plugins/`, or `backend/` directories at the repo root. Those patterns belong to other repos (plugins live in their own repos; transmittal-builder has a backend; this repo does not).
- `scripts/` is for repo-maintenance and release helpers. Not for anything the launcher executes at runtime.

## 8. Reference docs

- [`RELEASING.md`](../RELEASING.md) — release lifecycle
- [`TROUBLESHOOTING.md`](../TROUBLESHOOTING.md) — diagnostic playbook
- [`MIGRATION.md`](../MIGRATION.md) — version-to-version upgrade notes, including the `shopvac → launcher` rename and `frontend → shell` rename
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — local dev workflow
- [`docs/AUTO_UPDATER.md`](../docs/AUTO_UPDATER.md) — auto-updater contract (if present)
- [`docs/PLUGIN_INSTALLER.md`](../docs/PLUGIN_INSTALLER.md) — plugin installer architecture (create when the installer logic is implemented)

If you find a discrepancy between code and these docs, fixing the doc is part of your job, not someone else's.
