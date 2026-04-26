# Copilot Instructions

> **Repo:** `chamber-19/launcher`
> **Role:** Tauri shell that installs, updates, and launches Chamber 19 engineering tools

These instructions apply to GitHub Copilot (chat, agent mode, and code suggestions) when working in this repository. They are the same across every repo in the Chamber 19 tool family — what changes is the top matter above and the repo-specific rules at the bottom.

---

## Architecture context

This repo is part of the **Chamber 19 tool family**, a coordinated set of engineering tools with clear separation of concerns. Before making changes, understand which repo you're in and how it relates to the others.

### Repo roles

| Repo | Role | Language / stack |
|---|---|---|
| `chamber-19/desktop-toolkit` | Shared framework for Tauri desktop apps (splash, updater, NSIS installer, Python sidecar plumbing) | Rust + JS + Python + NSIS |
| `chamber-19/autocad-pipeline` | Shared MSBuild props + csproj template for AutoCAD .NET plugins | MSBuild XML only |
| `chamber-19/object-totaler` | AutoCAD plugin: `TOTAL` and `TOTALSIM` commands for curve length totaling | C# / .NET, consumes `autocad-pipeline` |
| `chamber-19/launcher` | Tauri shell that installs, updates, and launches Chamber 19 tools | Rust + React, consumes `desktop-toolkit` |
| `chamber-19/transmittal-builder` | Standalone Tauri app for generating engineering transmittals | Rust + React + Python, consumes `desktop-toolkit` |

This repo is **the hub of the Chamber 19 tool ecosystem.** Engineers download the launcher once. From then on, it manages the install and update of every other Chamber 19 tool — AutoCAD plugins (like `object-totaler`) get their DLLs fetched from GitHub Releases and installed under `%APPDATA%\Chamber19\AutoCAD\`; standalone desktop apps (like `transmittal-builder`) eventually get launched from here too.

This means the launcher has two jobs:

1. **Installer / updater** for AutoCAD plugins. On launch, checks each known plugin's GitHub Releases page, downloads new DLLs, writes to `%APPDATA%\Chamber19\AutoCAD\`, manages NETLOAD entries in the user's `acaddoc.lsp`.
2. **Launcher** for standalone desktop apps. Future role — not in v0.x scope.

In v0.1.0–v0.3.x the launcher is effectively just "the installer for `object-totaler`." The richer launcher UI emerges as more tools join the ecosystem.

### Non-goals for this family

- **No Suite-style infrastructure.** The `Koraji95-coder/Suite` repo is a reference implementation that over-built shared infrastructure before tools existed. Don't reconstruct it. Every abstraction in this family must be extracted from at least two working concrete implementations.
- **No speculative shared code.** If a "helper" or "common utility" would be used by only one consumer today, it stays in that consumer. Duplication across two repos is tolerable; premature abstraction is not.
- **No multi-phase rollouts with layered toolkits.** Ship the smallest working thing, then extract from real duplication.

### Non-goals specific to this repo

**Do NOT add in v0.1.x–v0.3.x:**

- A plugin catalog format (remote-fetched, user-editable, or otherwise). The launcher knows about plugins by hardcoded list. A catalog is a v0.4+ concern and only makes sense once there are 3+ plugins to catalog.
- Out-of-process communication with AutoCAD (named-pipe bridges, ROT enumeration, command dispatch). The launcher manages DLL files on disk and LISP entries — it does not talk to AutoCAD at runtime. A future tool might, but it won't be this one.
- Silent background updates. v0.3.0 checks at launch only — no timers, no periodic polls.
- Rollback of failed installs. An install that fails leaves the previous version in place; the user retries.
- A plugin source directory in this repo (`tools/`, `plugins/`, etc.). Plugins live in their own repos.

### Architectural decisions that persist across sessions

Use GitHub Copilot Memory (visible at Repo Settings → Copilot → Memory) to recall and update these as decisions evolve. Current state:

1. **`autocad-pipeline` is deliberately minimal.** v0.1.0 contains only `Directory.Build.props` and a parameterized `Plugin.csproj.template`. No shared C# code. No NuGet packages. No PowerShell scripts. These get added when plugin #2 exists and reveals concrete duplication, not before.
2. **AutoCAD plugin commands use bare names, no prefix.** If a future plugin needs a command, register it as `TOTAL` or `EXPORT`, not `CH19TOTAL` or `CH19EXPORT`. The Chamber 19 identity lives in package metadata, not in every command typed at the AutoCAD command line.
3. **Launcher is the installer/updater for AutoCAD plugins.** It does not ship plugin source code. Plugins live in their own repos (e.g. `object-totaler`). Launcher fetches their releases from GitHub and installs the DLL to `%APPDATA%\Chamber19\AutoCAD\`, managing NETLOAD via the user's `acaddoc.lsp`.
4. **GitHub Releases is the distribution channel, not a network share.** Even for internal use. This keeps engineers on VPN-optional workflows and is ready for external distribution if that ever happens.
5. **Plugins and the launcher release on independent tags.** Plugin tags live in their own repos. Launcher has its own version. A launcher update does not imply a plugin update and vice versa.
6. **This repo was renamed from `shopvac` to `launcher`.** Old clones need `git remote set-url origin https://github.com/chamber-19/launcher.git`. GitHub's redirect handles URLs automatically but don't rely on it in documentation.
7. **`frontend/` was renamed to `shell/`.** There is no backend this is the frontend of — it's a shell. Any reference to `frontend/` in docs or code paths is stale.
8. **GitHub Packages versions are immutable.** A bad `@chamber-19/desktop-toolkit` release cannot be yanked cleanly. When a toolkit release breaks this repo, fix forward with a new patch version upstream rather than trying to recall the bad one.

When making a decision that affects another repo or that future sessions need to respect, persist it to memory. Explicit state beats re-derivation every time.

### Memory scope — what to persist

GitHub Copilot Memory is enabled on this repo. Memories persist across sessions, are repo-scoped, tagged by agent and model, and auto-expire. The user can review and curate them at Repo Settings → Copilot → Memory.

**Persist to Copilot Memory:**

- Repo-specific discoveries that aren't in this instructions file (e.g. "Cargo.lock regeneration here also requires `cargo update -p desktop-toolkit-updater`, not just `-p desktop-toolkit`")
- Deviations from documented conventions (e.g. "this repo uses X where `docs/CONSUMING.md` implies Y")
- Recurring traps that cost time to discover (e.g. "don't disable `hooks-nsh-in-sync`, it catches real drift")
- In-flight decisions that span multiple sessions

**Do NOT persist to memory:**

- Architectural decisions that belong in this instructions file (they're more durable there, and they load every session)
- Cross-repo context that applies family-wide (belongs in this file's shared section)
- Per-PR context (PR title, branch name, transient commit hashes)
- Debugging state from a single session
- File contents — re-read files when needed, don't cache them in memory
- Anything you could infer by reading current files in the repo

When in doubt, prefer to re-read the repo over trusting stale memory. Memory is for repo-specific discoveries, not the shape of permanent decisions — those go in this file.

---

## Scope and style

### Coding style

- **Match the style already in the file.** Don't introduce a new formatting convention in a repo that has a consistent one. Read neighboring files first.
- **Be concise.** No explanatory comments on obvious code. Comments explain *why*, not *what*.
- **No scope creep.** If asked to fix a bug, fix the bug. Don't also refactor the surrounding code "while you're there" unless explicitly asked.
- **Prefer editing over rewriting.** When given a file to modify, produce a minimal diff. Don't rewrite the whole file to apply a one-line change.

### Response style in chat

- Match the length of the question. Short questions get short answers.
- Be direct. If a request is a bad idea, say so and explain why rather than complying silently.
- Don't narrate what you're about to do before doing it. Just do it, then describe the result if relevant.
- If uncertain, say you're uncertain. Don't fabricate confidence.

### When to push back

Actively push back when the user:

- Proposes reconstructing Suite-style infrastructure (e.g. a shared controller exe, a named-pipe RPC layer, a multi-layer toolkit with 4+ components) before there's concrete duplication justifying it
- Suggests building an abstraction "because we'll probably need it" — ask whether the need is experience-based or prediction-based
- Wants to bring plugin source code into this repo (e.g. "let's just put the AutoCAD plugin in `tools/` while we iterate")
- Wants to combine scoped work (e.g. "while we're renaming, let's also add the installer logic") — keep unrelated changes in separate PRs
- Wants to combine a `desktop-toolkit` pin bump with feature work in the same PR — separate them

---

## Code change discipline

When editing existing code:

- Match existing style, even if you'd do it differently. Don't reformat
  adjacent code or "improve" comments that weren't part of the request.
- Don't refactor things that aren't broken. If you notice unrelated dead
  code or smells, mention them in the PR description — don't delete or
  fix them in this PR.
- Every changed line should trace directly to the user's request. If you
  can't justify a line, remove it.
- Clean up only the orphans your own changes created (unused imports,
  variables, helpers that became unreachable). Pre-existing dead code
  stays unless explicitly asked.

When implementing:

- Minimum code that solves the problem. No speculative abstractions, no
  flexibility that wasn't requested, no error handling for scenarios that
  can't actually happen.
- If you wrote 200 lines and 50 would suffice, rewrite it.
- Senior-engineer test: Would a careful reviewer call this overcomplicated?
  If yes, simplify before opening the PR.

When uncertain:

- State your assumptions explicitly. Don't guess silently.
- If multiple interpretations of the request exist, present them. Don't
  pick one and proceed.
- If something is unclear, stop and ask. Naming what's confusing is more
  helpful than producing a guess.

---

## MCP server usage

This repo has MCP servers configured via the GitHub coding agent settings. Use them actively.

- **`github`**: preferred for anything on github.com. Use `create_or_update_file`, `push_files`, and `delete_file` for direct commits instead of going through the `git` server when the change is narrow and well-scoped. Use `list_workflow_jobs` + `download_workflow_run_logs` to diagnose specific CI job failures. Use `list_releases` and `get_release` when checking plugin version state (especially `chamber-19/object-totaler`) — the launcher installer depends on GitHub Releases API responses, so knowing what shape those responses take matters. Use `list_secret_scanning_alerts` and `list_code_scanning_alerts` when reviewing security posture.
- **`git`**: local repo operations. Use read operations (`git_status`, `git_diff`, `git_log`, `git_blame`) freely. Use `git` for multi-file changes that need careful staging. Never use destructive operations (`git_reset`, `git_clean`, force-push equivalents) without explicit confirmation.
- **`filesystem`** (scoped to `/workspaces`): read and write files in the current repo. Don't write outside the repo directory. Prefer `github.get_file_contents` when reading files from a *different* Chamber 19 repo.
- **`fetch`**: non-GitHub URLs only.
- **`sequential-thinking`**: use for any plan with 3+ dependent steps, especially cross-repo work or multi-step CI debugging. The installer flow itself is multi-step (fetch → verify SHA → install → update lisp → update manifest) and benefits from this when debugging.
- **`time`**: use for CHANGELOG entry dates, release tags, and any ISO-formatted timestamp. Do not guess the current date from memory — always fetch it via this server.
- **`svgmaker`**: for generating or editing SVG icons. Match the Chamber 19 design system. This repo uses iconography for plugin cards in the launcher UI — the main application of svgmaker across the family is here.

---

## Design system

Shared visual language across all Chamber 19 tools:

### Colors

- **Background neutral (dark):** `#1C1B19`
- **Accent (copper):** `#C4884D`
- **Success:** `#6B9E6B`
- **Warning:** `#C4A24D`
- **Error:** `#B85C5C`
- **Info:** `#5C8EB8`

### Typography

- **Body:** DM Sans
- **Technical / data / filenames / drawing numbers:** JetBrains Mono
- **Display / headers:** Instrument Serif

### Tone

- Warm industrial. Engineering-grade, not corporate-slick.
- Short, matter-of-fact copy. Avoid marketing voice.
- No emoji in UI copy or product names (in commit messages or chat, fine).

---

## Release conventions

### Versioning

- All repos use **SemVer** (`vMAJOR.MINOR.PATCH`)
- Breaking changes require a major version bump and a MIGRATION.md entry
- Libraries (`desktop-toolkit`, `autocad-pipeline`) publish immutable version tags — downstream consumers pin exact versions
- Consumer apps (`launcher`, `object-totaler`, `transmittal-builder`) can use `^x.y.z` ranges when depending on libraries

### Tags

- Format: `v[0-9]+.[0-9]+.[0-9]+` for releases
- Never use decorated tags like `release-0.1.0` — the repo context makes the tool name redundant

### Release artifacts

**Tauri app releases** must include:

- The NSIS installer `.exe`
- A `latest.json` manifest for the Tauri updater
- Signature files for auto-update verification
- Release notes linking to the CHANGELOG entry

### CHANGELOG

Follows Keep a Changelog conventions. Every release tag has a corresponding entry. Unreleased changes accumulate under `## [Unreleased]` and get promoted at release time. Use the `time` MCP server for the release date — do not guess it.

---

## PR and commit conventions

### Commit messages

- Imperative mood: `add plugin installer` not `added plugin installer`
- No period at the end of the subject line
- Wrap body at ~72 chars
- Conventional Commits prefix is optional but preferred (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)

### PR scope

- One concern per PR. Don't bundle a repo rename with a feature addition.
- PR titles follow the same style as commit messages
- PR description includes what changed, why, and any follow-up needed

### Draft PRs

Open a PR as draft when:

- The PR bumps the `desktop-toolkit` pin and is waiting on CI verification before going live
- The PR changes plugin installer logic and is waiting on end-to-end testing against a real plugin release
- CI feedback is wanted on a partial change before final commits
- A release is staged but should not be merged until downstream verification is complete

Convert to ready-for-review only once the coordinated flow is complete.

---

## Security

- Never commit secrets, tokens, or API keys
- `.env` files must be in `.gitignore`
- MCP configs reference environment variable names, never literal tokens
- When auditing dependency bump PRs, check for unexpected maintainer changes on popular packages (supply-chain attack vector)
- Use `github.list_secret_scanning_alerts` and `github.list_code_scanning_alerts` to review open security alerts before major releases
- The installer fetches DLLs from public GitHub Releases and verifies SHA256 before installing. Do not skip the SHA256 check "because it's a public repo" — the check defends against MITM on the download path, not just malicious repo content.

---

## Working across repos

When a task spans multiple Chamber 19 repos:

1. Use `sequential-thinking` to plan the order of operations
2. Start with the lowest-level dependency. If a change touches `desktop-toolkit` and `launcher`, ship the toolkit change first, tag it, then bump `launcher`'s pin
3. Make each repo's PR self-contained. A `launcher` PR shouldn't say "this works once you merge #42 in desktop-toolkit." It should either pin to a released version or be explicitly marked "blocked on X."
4. If a `desktop-toolkit` bump reveals a problem, **fix forward** in the toolkit with a new patch version rather than yanking. GitHub Packages versions are immutable; a published bad release cannot be cleanly recalled, only superseded.
5. If a plugin (e.g. `object-totaler`) changes its release asset names or shapes, coordinate with a launcher PR first — the installer depends on specific asset names
6. If the relationship or decision is repo-specific (e.g. a new version pin contract), persist it to Copilot Memory. If it's family-wide, the user will update the instructions file.

---

## When you don't know

- Check Copilot Memory first (repo-specific discoveries and recurring traps live there)
- Then check the repo's `MIGRATION.md`, `RELEASING.md`, `CHANGELOG.md`, and `README.md`
- Then search across the five Chamber 19 repos via the `github` server
- Only then ask the user — and when you ask, ask a specific question, not an open-ended one

---

---

# Repo-specific rules — launcher

Everything above this section is shared across all Chamber 19 repos. Everything below is specific to `launcher` and must be followed in every PR that touches this repo.

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
