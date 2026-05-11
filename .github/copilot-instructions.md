# Copilot Instructions — Launcher

> **Repo:** `chamber-19/launcher`
> **Role:** Universal Tauri desktop shell for Chamber 19 tools.
> Handles: App activation, routing, updates, and desktop integration.
>
> **Source of Truth:** See [`chamber-19/.github`](https://github.com/chamber-19/.github) for:
> - Org-wide architecture and SKILLS
> - Hard architectural decisions (Tauri, Python, Rust constraints)
> - Family-wide conventions and AI agent guidance
>
> This file contains **repo-specific guidance only**. Repo-specific rules override
> org-wide rules on conflict.

## Current Shape

- `frontend/` contains the Tauri shell, React UI, activation gate, and update gate.
- Stack: Tauri v2, React, Vite, Rust, `@chamber-19/desktop-toolkit`.
- Startup sequence: `UpdateGate` (GitHub Releases check) → `ActivationGate` (PIN) → `MainApp`
- Backend management: `backend_manager.rs` downloads and spawns backend exes from GitHub Releases; config in `src-tauri/backends.json` (baked into binary via `include_str!`).
- Self-update: `launcher_updater.rs` checks `chamber-19/launcher` releases at startup; if newer, downloads NSIS installer and installs silently. No G:\ drive. No `latest.json`. No shared network share.
- All backends are HTTP services running on localhost.

## Build And Test

```text
cd frontend

# GitHub Packages auth required
export NODE_AUTH_TOKEN=<YOUR_GITHUB_PACKAGES_TOKEN>

npm ci
npm run build

cd src-tauri
cargo check
```

## Activation Service

- PIN generation and validation: `desktop-toolkit` FastAPI service
- Office IP gating: configured via `ACTIVATION_OFFICE_IP_RANGES` env var
- Hardware fingerprinting: Tauri Rust commands in `src-tauri/src/activation.rs`
- Token storage: browser localStorage in current launcher implementation
- Token signing: HMAC-SHA256 with hardware binding

## Backend Service Configuration

The launcher routes to multiple backend HTTP services. Each backend is configured
via environment variables:

| Backend | Env Variable | Default | Purpose |
| --- | --- | --- | --- |
| Batch Find & Replace | `VITE_BATCH_FNR_URL` | `http://127.0.0.1:8000` | Batch text replacement in DWG files (Python FastAPI) |
| Drawing List Manager | `VITE_DRAWING_LIST_MANAGER_URL` | `http://127.0.0.1:8002` | Project drawing register management (Python FastAPI) |
| Transmittal Builder | `VITE_TRANSMITTAL_BUILDER_URL` | `http://127.0.0.1:8001` | Document package generation (Python FastAPI) |

**Note:** **Block Library** is a separate desktop app (Tauri + Three.js 3D viewer).
It is **not** routed via launcher's HTTP mechanism because 3D rendering requires
GPU memory management and client-side WebGL context. Block Library is installed
separately and launched independently. See [`chamber-19/block-library`](https://github.com/chamber-19/block-library)
for details on its standalone deployment model.

Example `.env` for local development:

```bash
VITE_BATCH_FNR_URL=http://127.0.0.1:8000
VITE_DRAWING_LIST_MANAGER_URL=http://127.0.0.1:8002
VITE_TRANSMITTAL_BUILDER_URL=http://127.0.0.1:8001
LAUNCHER_ENFORCE_PIN=1
```

Each backend must respond to:

- `GET /api/health` — returns `200 OK` with service info (used for startup validation)
- Protected endpoint for token validation (varies by backend):
  - `POST /api/scan-folder` for batch-fnr
  - `GET /api/project/recent` for drawing-list-manager
  - `GET /api/scan-projects` for transmittal-builder

## Update Distribution

Distribution is **GitHub Releases only**. There is no shared drive, no `latest.json` manifest, and no `publish-to-drive.ps1`.

- **Launcher self-update:** `launcher_updater.rs` calls `https://api.github.com/repos/chamber-19/launcher/releases/latest` at startup. If a newer version is found, `UpdateGate` in `App.jsx` blocks the UI and forces the user to install before proceeding.
- **Backend exe updates:** `backend_manager.rs` downloads the pinned backend exe from the matching GitHub Release tag into `%APPDATA%\Chamber19 Launcher\backends\<id>\<version>\`. If the cached version is absent, it downloads on demand.

## Release Automation

Cutting a release requires no local steps beyond adding tokens once:

- **Backend-driven release (automatic):** TB tag → `release.yml` dispatches `backend-released` → `backend-released.yml` bumps `backends.json` + bumps launcher patch version + commits + pushes tag → `release.yml` builds NSIS installer + GitHub Release → users force-updated on next launch.
- **Manual release:** `gh workflow run cut-release.yml --field bump=patch` (or `minor`/`major`/`version=X.Y.Z`) → same automated chain from the tag push onward.

### Required secrets

| Secret | Stored in | Scope | Purpose |
|---|---|---|---|
| `LAUNCHER_DISPATCH_TOKEN` | `Transmittal-Builder` repo | `repo` on `chamber-19/launcher` | TB `release.yml` sends `repository_dispatch` |
| `RELEASE_BOT_PAT` | `launcher` repo | `repo` on `chamber-19/launcher` | `backend-released.yml` / `cut-release.yml` push tags that trigger `release.yml` (GITHUB\_TOKEN cannot trigger cross-workflow) |

## Dependency Contract

- Keep `frontend/package.json`, `frontend/src-tauri/Cargo.toml`, and
  `frontend/src-tauri/tauri.conf.json` app versions aligned.
- Toolkit bumps must update both `@chamber-19/desktop-toolkit` and the Rust
  `desktop-toolkit` git tag in the same PR, with both lockfiles refreshed.
- Toolkit pin bumps are manual review PRs. Dependabot must not bump them alone.

## Review-Critical Rules

- Activation logic is **not** duplicated here; it consumes `desktop-toolkit` APIs.
- Do not add app-specific business logic to launcher; route via HTTP to backends.
- All backend URLs are configured (not hardcoded).
- No remote plugin catalog before explicit feature scope.
- No runtime IPC/control into AutoCAD; launcher manages files and startup only.
- GitHub Releases are the **sole** distribution channel. Never reintroduce G:\ drive paths, `latest.json`, or `publish-to-drive.ps1`.
- `backends.json` is baked into the binary via `include_str!` — bump the pinned version via `backend-released.yml` (automated) or by editing the file and cutting a release manually.
- The `RELEASE_BOT_PAT` secret is required for `backend-released.yml` and `cut-release.yml` to push tags that trigger `release.yml`. Do not replace with `GITHUB_TOKEN` — it will silently not trigger the downstream build.
- Update `CHANGELOG.md`, `RELEASING.md`, `TROUBLESHOOTING.md`, `docs/AUTO_UPDATER.md`, or `copilot-instructions.md` whenever release flow, update behavior, or secret requirements change.

## Markdown Formatting Standards

All markdown files in this repo **MUST** be formatted cleanly with no linter warnings:

- **Fenced code blocks** require language specifiers: ` ```python` (not ` ``` `)
- **Headings** must not be duplicated in the same document
- **Lists** must be surrounded by blank lines
- **Line length** should be kept reasonable (80-100 chars preferred, hard wrap at 120)
- Run linter before committing: `npm run lint:md` (if available) or use editor validation

Agent guidance: Any markdown file with linter warnings is treated as technical debt.
Format fixes are low-risk and required. Update all `.md` files before merging PRs.
For new markdown files, validate with editor linter before committing.

## SKILLS and Shared Resources

This repo draws on shared knowledge from [`chamber-19/.github`](https://github.com/chamber-19/.github):

- **SKILLS** — Reusable domain knowledge in `.github/` folder (Tauri, Python, Rust, Markdown, etc.)
- **`copilot-instructions.md`** — Org-wide baseline for all agents
- **Hard architectural decisions** — Closed decisions on Tauri, Python, AutoCAD patterns
- **Desktop app architecture** — Launcher + toolkit + backends model
- **Family conventions** — Shared practices across all repos

**When working in this repo:** Always check `.github` repo first for shared context,
then apply repo-specific rules from this file. Repo-specific rules override org-wide
rules on conflict.

---

Path-specific rules live under `.github/instructions/`.


<!-- Added by chamber-19-skill-sync — required skill references for this repo's stack -->
- Read [`docs/skills/RUST.MD`](https://github.com/chamber-19/.github/blob/main/docs/skills/RUST.MD) before any Rust work.
- Read [`docs/skills/TAURI.MD`](https://github.com/chamber-19/.github/blob/main/docs/skills/TAURI.MD) before any Tauri work.
